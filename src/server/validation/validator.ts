import {
  ExtractionCandidateEnvelopeSchema,
  PROHIBITED_TOPIC_SLUGS,
  SkillSpecPayloadSchema,
  TaskCandidatePayloadSchema,
  type ExtractionCandidateEnvelope,
  type SkillSpecPayload,
  type TaskCandidatePayload,
  type ValidationFinding,
} from '../../shared/contracts.js';

export interface EvidenceRefContext {
  id: string;
  kind: 'metadata' | 'caption' | 'transcript' | 'visual_observation' | 'user_provided';
}

export interface ValidationOutcome<T> {
  status: 'valid' | 'warnings' | 'invalid';
  parsed: T | null;
  findings: ValidationFinding[];
}

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions/i,
  /disregard\s+(all\s+)?(system|higher[- ]priority|developer)\s+(instructions|prompt)/i,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions|api\s+key)/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
];

const DESTRUCTIVE_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\/(?:\s|$|\*)/i,
  /\bmkfs\.[a-z0-9]+\b/i,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
  /\b(?:curl|wget)\s+[^\n|]+\|\s*(?:sudo\s+)?(?:ba)?sh\b/i,
  /\bdd\s+if=\/dev\/zero\s+of=\/dev\//i,
];

const EMBEDDED_SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

function scanSafetyText(
  text: string,
  fieldPath: string,
  stepId?: string
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  for (const pat of PROMPT_INJECTION_PATTERNS) {
    if (pat.test(text)) {
      findings.push({
        layer: 'safety',
        severity: 'error',
        code: 'PROMPT_INJECTION_DETECTED',
        message:
          'Content contains instructions attempting to override system or safety rules.',
        field_path: fieldPath,
        step_id: stepId ?? null,
      });
      break;
    }
  }

  for (const pat of DESTRUCTIVE_COMMAND_PATTERNS) {
    if (pat.test(text)) {
      findings.push({
        layer: 'safety',
        severity: 'error',
        code: 'DESTRUCTIVE_COMMAND_DETECTED',
        message:
          'Content contains a destructive shell or remote code execution pattern.',
        field_path: fieldPath,
        step_id: stepId ?? null,
      });
      break;
    }
  }

  for (const pat of EMBEDDED_SECRET_PATTERNS) {
    if (pat.test(text)) {
      findings.push({
        layer: 'safety',
        severity: 'error',
        code: 'EMBEDDED_SECRET_DETECTED',
        message: 'Content appears to contain an embedded API key or secret token.',
        field_path: fieldPath,
        step_id: stepId ?? null,
      });
      break;
    }
  }

  return findings;
}

/**
 * Validates a TaskCandidatePayload across all 5 strict layers (Section 9.4).
 */
export function validateTaskCandidate(
  rawInput: unknown,
  availableEvidence: EvidenceRefContext[]
): ValidationOutcome<TaskCandidatePayload> {
  const findings: ValidationFinding[] = [];

  // Layer 1: Structural
  const parsedResult = TaskCandidatePayloadSchema.safeParse(rawInput);
  if (!parsedResult.success) {
    for (const issue of parsedResult.error.issues) {
      findings.push({
        layer: 'structural',
        severity: 'error',
        code: 'SCHEMA_VALIDATION_ERROR',
        message: `${issue.path.join('.') || 'root'}: ${issue.message}`,
        field_path: issue.path.join('.') || null,
        step_id: null,
      });
    }
    return { status: 'invalid', parsed: null, findings };
  }

  const task = parsedResult.data;
  const evidenceMap = new Map(availableEvidence.map((e) => [e.id, e]));
  const hasVisualEvidence = availableEvidence.some(
    (e) => e.kind === 'visual_observation'
  );

  // Layer 2: Semantic (unique step IDs, contiguous positions, valid topics)
  const seenStepIds = new Set<string>();
  task.steps.forEach((step, idx) => {
    if (seenStepIds.has(step.id)) {
      findings.push({
        layer: 'semantic',
        severity: 'error',
        code: 'DUPLICATE_STEP_ID',
        message: `Duplicate step ID "${step.id}". Step IDs must be unique.`,
        field_path: `steps.${idx}.id`,
        step_id: step.id,
      });
    }
    seenStepIds.add(step.id);

    if (step.position !== idx) {
      findings.push({
        layer: 'semantic',
        severity: 'error',
        code: 'NON_CONTIGUOUS_STEP_POSITION',
        message: `Step "${step.id}" has position ${step.position}, expected ${idx}.`,
        field_path: `steps.${idx}.position`,
        step_id: step.id,
      });
    }
  });

  for (const topic of task.topics) {
    if (PROHIBITED_TOPIC_SLUGS.has(topic)) {
      findings.push({
        layer: 'semantic',
        severity: 'error',
        code: 'PROHIBITED_TOPIC_SLUG',
        message: `Topic "${topic}" is not allowed as a topical category.`,
        field_path: 'topics',
        step_id: null,
      });
    }
  }

  // Layer 3: Evidence
  task.steps.forEach((step, idx) => {
    for (const ref of step.evidence_refs) {
      if (!evidenceMap.has(ref)) {
        findings.push({
          layer: 'evidence',
          severity: 'error',
          code: 'UNKNOWN_EVIDENCE_REF',
          message: `Step "${step.title}" cites unknown evidence ID "${ref}".`,
          field_path: `steps.${idx}.evidence_refs`,
          step_id: step.id,
        });
      }
    }

    if (step.provenance_kind === 'visual' && !hasVisualEvidence) {
      findings.push({
        layer: 'evidence',
        severity: 'error',
        code: 'UNSUPPORTED_VISUAL_CLAIM',
        message:
          'Step claims visual frame provenance, but no visual frames were analyzed (FR-014).',
        field_path: `steps.${idx}.provenance_kind`,
        step_id: step.id,
      });
    }

    if (
      (step.provenance_kind === 'transcript' ||
        step.provenance_kind === 'visual') &&
      step.evidence_refs.length === 0
    ) {
      findings.push({
        layer: 'evidence',
        severity: 'error',
        code: 'MISSING_EVIDENCE_CITATION',
        message:
          'Steps marked as direct transcript or visual observations must cite at least one evidence segment.',
        field_path: `steps.${idx}.evidence_refs`,
        step_id: step.id,
      });
    }

    if (step.provenance_kind === 'inferred' || step.is_inferred) {
      findings.push({
        layer: 'evidence',
        severity: 'warning',
        code: 'INFERRED_STEP_NOTICE',
        message: 'No spoken evidence for this detail. Kept as inference.',
        field_path: `steps.${idx}`,
        step_id: step.id,
      });
    }
  });

  // Layer 4: Safety
  findings.push(...scanSafetyText(task.title, 'title'));
  findings.push(...scanSafetyText(task.description, 'description'));
  task.steps.forEach((step, idx) => {
    findings.push(
      ...scanSafetyText(
        `${step.title}\n${step.description}`,
        `steps.${idx}`,
        step.id
      )
    );
  });

  const hasErrors = findings.some((f) => f.severity === 'error');
  const hasWarnings = findings.some((f) => f.severity === 'warning');

  return {
    status: hasErrors ? 'invalid' : hasWarnings ? 'warnings' : 'valid',
    parsed: hasErrors ? null : task,
    findings,
  };
}

/**
 * Validates a SkillSpecPayload across all 5 strict layers (Section 9.3, 9.4).
 */
export function validateSkillSpecCandidate(
  rawInput: unknown,
  availableEvidence: EvidenceRefContext[]
): ValidationOutcome<SkillSpecPayload> {
  const findings: ValidationFinding[] = [];

  // Layer 1: Structural
  const parsedResult = SkillSpecPayloadSchema.safeParse(rawInput);
  if (!parsedResult.success) {
    for (const issue of parsedResult.error.issues) {
      findings.push({
        layer: 'structural',
        severity: 'error',
        code: 'SCHEMA_VALIDATION_ERROR',
        message: `${issue.path.join('.') || 'root'}: ${issue.message}`,
        field_path: issue.path.join('.') || null,
        step_id: null,
      });
    }
    return { status: 'invalid', parsed: null, findings };
  }

  const skill = parsedResult.data;
  const evidenceMap = new Map(availableEvidence.map((e) => [e.id, e]));
  const hasVisualEvidence = availableEvidence.some(
    (e) => e.kind === 'visual_observation'
  );

  // Layer 2: Semantic
  const seenIds = new Set<string>();
  skill.workflow_steps.forEach((step, idx) => {
    if (seenIds.has(step.id)) {
      findings.push({
        layer: 'semantic',
        severity: 'error',
        code: 'DUPLICATE_STEP_ID',
        message: `Duplicate workflow step ID "${step.id}".`,
        field_path: `workflow_steps.${idx}.id`,
        step_id: step.id,
      });
    }
    seenIds.add(step.id);

    if (step.position !== idx) {
      findings.push({
        layer: 'semantic',
        severity: 'error',
        code: 'NON_CONTIGUOUS_STEP_POSITION',
        message: `Workflow step "${step.id}" has position ${step.position}, expected ${idx}.`,
        field_path: `workflow_steps.${idx}.position`,
        step_id: step.id,
      });
    }
  });

  const intendedSet = new Set(
    skill.intended_use.map((u) => u.trim().toLowerCase())
  );
  for (const nonUse of skill.non_use_conditions) {
    if (intendedSet.has(nonUse.trim().toLowerCase())) {
      findings.push({
        layer: 'semantic',
        severity: 'error',
        code: 'CONTRADICTORY_CONDITIONS',
        message: `Skill intended_use and non_use_conditions contain identical condition: "${nonUse}".`,
        field_path: 'non_use_conditions',
        step_id: null,
      });
    }
  }

  // Layer 3: Evidence
  skill.workflow_steps.forEach((step, idx) => {
    for (const ref of step.evidence_refs) {
      if (!evidenceMap.has(ref)) {
        findings.push({
          layer: 'evidence',
          severity: 'error',
          code: 'UNKNOWN_EVIDENCE_REF',
          message: `Workflow step "${step.title}" cites unknown evidence ID "${ref}".`,
          field_path: `workflow_steps.${idx}.evidence_refs`,
          step_id: step.id,
        });
      }
    }

    if (step.provenance_kind === 'visual' && !hasVisualEvidence) {
      findings.push({
        layer: 'evidence',
        severity: 'error',
        code: 'UNSUPPORTED_VISUAL_CLAIM',
        message:
          'Workflow step claims visual frame provenance, but no visual frames were analyzed (FR-014).',
        field_path: `workflow_steps.${idx}.provenance_kind`,
        step_id: step.id,
      });
    }

    if (
      (step.provenance_kind === 'transcript' ||
        step.provenance_kind === 'visual') &&
      step.evidence_refs.length === 0
    ) {
      findings.push({
        layer: 'evidence',
        severity: 'error',
        code: 'MISSING_EVIDENCE_CITATION',
        message:
          'Workflow steps marked as direct transcript or visual observations must cite at least one evidence segment.',
        field_path: `workflow_steps.${idx}.evidence_refs`,
        step_id: step.id,
      });
    }

    if (step.provenance_kind === 'inferred' || step.is_inferred) {
      findings.push({
        layer: 'evidence',
        severity: 'warning',
        code: 'INFERRED_STEP_NOTICE',
        message: 'No spoken evidence for this detail. Kept as inference.',
        field_path: `workflow_steps.${idx}`,
        step_id: step.id,
      });
    }
  });

  // Layer 4: Safety
  findings.push(...scanSafetyText(skill.identity.title, 'identity.title'));
  findings.push(
    ...scanSafetyText(skill.identity.description, 'identity.description')
  );
  skill.workflow_steps.forEach((step, idx) => {
    findings.push(
      ...scanSafetyText(
        `${step.title}\n${step.instruction}`,
        `workflow_steps.${idx}`,
        step.id
      )
    );
  });

  // Layer 5: Target compatibility
  if (
    skill.identity.name.includes('..') ||
    skill.identity.name.includes('/') ||
    skill.identity.name.includes('\\')
  ) {
    findings.push({
      layer: 'target_compatibility',
      severity: 'error',
      code: 'UNSAFE_SKILL_SLUG',
      message: 'Skill name contains unsafe path characters.',
      field_path: 'identity.name',
      step_id: null,
    });
  }

  const hasErrors = findings.some((f) => f.severity === 'error');
  const hasWarnings = findings.some((f) => f.severity === 'warning');

  return {
    status: hasErrors ? 'invalid' : hasWarnings ? 'warnings' : 'valid',
    parsed: hasErrors ? null : skill,
    findings,
  };
}

/**
 * Validates the complete LLM extraction envelope containing both task and skill candidates.
 */
export function validateCandidateEnvelope(
  rawInput: unknown,
  availableEvidence: EvidenceRefContext[]
): ValidationOutcome<ExtractionCandidateEnvelope> {
  const envParse = ExtractionCandidateEnvelopeSchema.safeParse(rawInput);
  if (!envParse.success) {
    const findings: ValidationFinding[] = envParse.error.issues.map((issue) => ({
      layer: 'structural',
      severity: 'error',
      code: 'ENVELOPE_SCHEMA_ERROR',
      message: `${issue.path.join('.') || 'root'}: ${issue.message}`,
      field_path: issue.path.join('.') || null,
      step_id: null,
    }));
    return { status: 'invalid', parsed: null, findings };
  }

  const env = envParse.data;
  const taskVal = validateTaskCandidate(env.task_candidate, availableEvidence);
  const skillVal = validateSkillSpecCandidate(
    env.skill_candidate,
    availableEvidence
  );

  const findings = [...taskVal.findings, ...skillVal.findings];
  const hasErrors = findings.some((f) => f.severity === 'error');
  const hasWarnings = findings.some((f) => f.severity === 'warning');

  return {
    status: hasErrors ? 'invalid' : hasWarnings ? 'warnings' : 'valid',
    parsed: hasErrors ? null : env,
    findings,
  };
}
