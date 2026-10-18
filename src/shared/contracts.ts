import { z } from 'zod';

export const PIPELINE_VERSION = '1.1.0';
export const TASK_SCHEMA_VERSION = '1.1.0';
export const SKILL_SPEC_SCHEMA_VERSION = '1.1.0';
export const VALIDATOR_VERSION = '1.1.0';
export const RENDERER_VERSION = '1.1.0';

export const PlatformEnum = z.enum(['youtube', 'instagram']);
export type Platform = z.infer<typeof PlatformEnum>;

export const ArtifactTypeEnum = z.enum([
  'task',
  'ai_skill',
  'plan',
  'habit',
  'tip_reference',
]);
export type ArtifactType = z.infer<typeof ArtifactTypeEnum>;

export const MvpArtifactTypeEnum = z.enum(['task', 'ai_skill']);
export type MvpArtifactType = z.infer<typeof MvpArtifactTypeEnum>;

export const JobStatusEnum = z.enum([
  'queued',
  'acquiring',
  'transcribing',
  'analyzing',
  'needs_review',
  'completed',
  'failed',
  'cancelled',
]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

export const JobStageEnum = z.enum([
  'queued',
  'acquiring',
  'transcribing',
  'analyzing',
  'needs_review',
]);
export type JobStage = z.infer<typeof JobStageEnum>;

export const EvidenceKindEnum = z.enum([
  'metadata',
  'caption',
  'transcript',
  'visual_observation',
  'user_provided',
]);
export type EvidenceKind = z.infer<typeof EvidenceKindEnum>;

export const ProvenanceKindEnum = z.enum([
  'transcript',
  'visual',
  'inferred',
  'user_edited',
]);
export type ProvenanceKind = z.infer<typeof ProvenanceKindEnum>;

export const ErrorCodeEnum = z.enum([
  'INVALID_URL',
  'UNSUPPORTED_PLATFORM',
  'UNSUPPORTED_URL_PATTERN',
  'SSRF_BLOCKED',
  'CONNECTOR_DISABLED',
  'SOURCE_UNAVAILABLE',
  'ACCESS_DENIED',
  'PLATFORM_RATE_LIMITED',
  'MEDIA_TOO_LARGE',
  'TRANSCRIPT_UNAVAILABLE',
  'TRANSCRIPTION_PROVIDER_FAILURE',
  'VISUAL_PROCESSING_FAILURE',
  'LLM_NOT_CONFIGURED',
  'LLM_PROVIDER_FAILURE',
  'SCHEMA_VALIDATION_FAILURE',
  'SAFETY_REVIEW_REQUIRED',
  'DATABASE_FAILURE',
  'EXPORT_COMPATIBILITY_FAILURE',
]);
export type ErrorCode = z.infer<typeof ErrorCodeEnum>;

export const AllowedSkillCapabilityEnum = z.enum(['instruction_only']);
export type AllowedSkillCapability = z.infer<typeof AllowedSkillCapabilityEnum>;

export const SkillExportTargetEnum = z.enum([
  'claude_code_skill',
  'codex_agents_skill',
]);
export type SkillExportTarget = z.infer<typeof SkillExportTargetEnum>;

// Reserved/prohibited topic slugs per Section 3.2 (UC-04) and Section 7.3
export const PROHIBITED_TOPIC_SLUGS = new Set([
  'short_term',
  'short-term',
  'task',
  'ai_skill',
  'ai-skill',
  'plan',
  'habit',
  'tip_reference',
]);

export const TopicSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Topic slug must be lowercase kebab-case')
  .refine(
    (val) => !PROHIBITED_TOPIC_SLUGS.has(val),
    'Topic cannot be an artifact type or "short-term" (UC-04, FR-043)'
  );

export const EvidenceCitationSchema = z
  .object({
    evidence_id: z.string().min(1).max(128),
    provenance_kind: ProvenanceKindEnum,
    start_ms: z.number().int().nonnegative().nullable().optional(),
    end_ms: z.number().int().nonnegative().nullable().optional(),
    excerpt: z.string().max(300).optional(),
  })
  .strict();
export type EvidenceCitation = z.infer<typeof EvidenceCitationSchema>;

export const TaskStepCandidateSchema = z
  .object({
    id: z.string().min(1).max(64),
    position: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1500).default(''),
    provenance_kind: ProvenanceKindEnum,
    is_inferred: z.boolean().default(false),
    is_user_edited: z.boolean().default(false),
    evidence_refs: z.array(z.string().min(1).max(128)).max(10).default([]),
    caveats: z.string().trim().max(500).nullable().optional(),
  })
  .strict();
export type TaskStepCandidate = z.infer<typeof TaskStepCandidateSchema>;

export const TaskCandidatePayloadSchema = z
  .object({
    schema_version: z.literal(TASK_SCHEMA_VERSION),
    artifact_type: z.literal('task'),
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().min(2).max(2500),
    steps: z.array(TaskStepCandidateSchema).min(1).max(30),
    topics: z.array(TopicSlugSchema).min(1).max(8),
    estimated_minutes: z.number().int().positive().max(1440).nullable().optional(),
    deadline: z.null().optional(), // LLM must never invent a deadline (FR-025)
    priority: z.null().optional(), // LLM must never invent a priority (FR-025)
  })
  .strict();
export type TaskCandidatePayload = z.infer<typeof TaskCandidatePayloadSchema>;

export const SkillInputFieldSchema = z
  .object({
    name: z.string().trim().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_-]*$/),
    type: z.enum(['string', 'number', 'boolean', 'code_snippet', 'file_path', 'text_block']),
    required: z.boolean(),
    description: z.string().trim().min(1).max(400),
  })
  .strict();

export const SkillWorkflowStepSchema = z
  .object({
    id: z.string().min(1).max(64),
    position: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(200),
    instruction: z.string().trim().min(2).max(2000),
    condition: z.string().trim().max(400).nullable().optional(),
    provenance_kind: ProvenanceKindEnum,
    is_inferred: z.boolean().default(false),
    is_user_edited: z.boolean().default(false),
    evidence_refs: z.array(z.string().min(1).max(128)).max(10).default([]),
  })
  .strict();
export type SkillWorkflowStep = z.infer<typeof SkillWorkflowStepSchema>;

export const SkillSpecPayloadSchema = z
  .object({
    schema_version: z.literal(SKILL_SPEC_SCHEMA_VERSION),
    artifact_type: z.literal('ai_skill'),
    identity: z
      .object({
        name: z
          .string()
          .trim()
          .min(2)
          .max(64)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Skill name must be kebab-case'),
        title: z.string().trim().min(2).max(180),
        summary: z.string().trim().min(2).max(400),
        description: z.string().trim().min(2).max(2500),
      })
      .strict(),
    intended_use: z.array(z.string().trim().min(2).max(400)).min(1).max(10),
    non_use_conditions: z.array(z.string().trim().min(2).max(400)).min(1).max(10),
    trigger_examples: z.array(z.string().trim().min(2).max(300)).min(1).max(8),
    input_contract: z
      .object({
        fields: z.array(SkillInputFieldSchema).max(15),
        notes: z.string().trim().max(500).nullable().optional(),
      })
      .strict(),
    workflow_steps: z.array(SkillWorkflowStepSchema).min(1).max(30),
    output_contract: z
      .object({
        format: z.enum(['markdown', 'code_diff', 'structured_text', 'checklist']),
        description: z.string().trim().min(2).max(800),
        verification_criteria: z.array(z.string().trim().min(2).max(300)).min(1).max(10),
      })
      .strict(),
    capability_declarations: z
      .array(AllowedSkillCapabilityEnum)
      .min(1)
      .max(1)
      .default(['instruction_only']),
    topics: z.array(TopicSlugSchema).min(1).max(8),
  })
  .strict();
export type SkillSpecPayload = z.infer<typeof SkillSpecPayloadSchema>;

export const ExtractionCandidateEnvelopeSchema = z
  .object({
    schema_version: z.string(),
    recommended_type: MvpArtifactTypeEnum,
    recommendation_reason: z.string().trim().min(5).max(400),
    task_candidate: TaskCandidatePayloadSchema,
    skill_candidate: SkillSpecPayloadSchema,
    evidence_summary: z
      .object({
        transcript_analyzed: z.boolean(),
        visual_frames_analyzed: z.number().int().nonnegative(),
        visual_note: z.string().max(300),
      })
      .strict(),
  })
  .strict();
export type ExtractionCandidateEnvelope = z.infer<
  typeof ExtractionCandidateEnvelopeSchema
>;

export const ValidationFindingSchema = z
  .object({
    layer: z.enum([
      'structural',
      'semantic',
      'evidence',
      'safety',
      'target_compatibility',
    ]),
    severity: z.enum(['error', 'warning', 'info']),
    code: z.string(),
    message: z.string(),
    field_path: z.string().nullable().optional(),
    step_id: z.string().nullable().optional(),
  })
  .strict();
export type ValidationFinding = z.infer<typeof ValidationFindingSchema>;

export const UserSettingsSchema = z
  .object({
    theme: z.enum(['system', 'dark', 'light']).default('dark'),
    reduced_motion: z.boolean().default(false),
    content_language: z.enum(['en', 'hi', 'auto']).default('auto'),
    timezone: z.string().min(1).max(64).default('UTC'),
  })
  .strict();
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const SubmitJobRequestSchema = z
  .object({
    url: z.string().trim().max(2048).optional(),
    pasted_transcript: z.string().trim().max(50000).optional(),
    source_title: z.string().trim().max(250).optional(),
    language: z.string().trim().max(16).optional(),
    force_new: z.boolean().optional().default(false),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(data.url && data.url.length > 0) ||
      Boolean(data.pasted_transcript && data.pasted_transcript.length >= 10),
    {
      message:
        'Provide either a valid video link or a transcript of at least 10 characters.',
    }
  );
export type SubmitJobRequest = z.infer<typeof SubmitJobRequestSchema>;

export const ConfirmArtifactRequestSchema = z
  .object({
    job_id: z.string().min(1).max(128),
    selected_type: MvpArtifactTypeEnum,
    provenance_mode: z
      .enum(['model_extracted', 'user_edited', 'user_created'])
      .default('model_extracted'),
    task_payload: TaskCandidatePayloadSchema.optional(),
    skill_payload: SkillSpecPayloadSchema.optional(),
    user_deadline: z.string().datetime().nullable().optional(),
  })
  .strict()
  .refine(
    (data) =>
      (data.selected_type === 'task' && Boolean(data.task_payload)) ||
      (data.selected_type === 'ai_skill' && Boolean(data.skill_payload)),
    {
      message: 'Selected artifact type must include its corresponding payload.',
    }
  );
export type ConfirmArtifactRequest = z.infer<typeof ConfirmArtifactRequestSchema>;
