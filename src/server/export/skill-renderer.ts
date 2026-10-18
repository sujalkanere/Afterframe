import crypto from 'node:crypto';
import {
  RENDERER_VERSION,
  SkillExportTargetEnum,
  type SkillExportTarget,
  type SkillSpecPayload,
  type ValidationFinding,
} from '../../shared/contracts.js';
import type { DatabaseClient } from '../db/index.js';
import { computeSha256 } from '../jobs/idempotency.js';
import { validateSkillSpecCandidate } from '../validation/validator.js';

export interface RenderedPackageFile {
  relativePath: string;
  contentType: 'text/markdown' | 'application/json';
  content: string;
  sha256: string;
}

export interface RenderedSkillPackage {
  exportId: string;
  skillVersionId: string;
  versionNumber: number;
  target: SkillExportTarget;
  rendererVersion: string;
  packageHash: string;
  validationStatus: 'valid' | 'compatible' | 'invalid';
  compatible: boolean;
  testedInTarget: false;
  testedNote: string;
  findings: ValidationFinding[];
  files: RenderedPackageFile[];
}

const ALLOWED_EXTENSIONS = new Set(['.md', '.json']);
const FORBIDDEN_EXTENSIONS = new Set([
  '.sh',
  '.bash',
  '.zsh',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bat',
  '.cmd',
  '.ps1',
  '.py',
  '.js',
  '.ts',
  '.bin',
]);

/**
 * Validates archive/package file paths against path traversal and executable bundling (NFR-026).
 */
export function validateSafePackagePath(relPath: string): {
  ok: boolean;
  reason?: string;
} {
  if (!relPath || typeof relPath !== 'string') {
    return { ok: false, reason: 'Empty file path.' };
  }
  if (
    relPath.startsWith('/') ||
    relPath.startsWith('\\') ||
    /^[a-zA-Z]:/.test(relPath)
  ) {
    return { ok: false, reason: 'Absolute paths are prohibited in export packages.' };
  }
  if (relPath.includes('..') || relPath.includes('\\') || relPath.includes('\0')) {
    return {
      ok: false,
      reason: 'Path traversal sequences and backslashes are prohibited.',
    };
  }

  const lower = relPath.toLowerCase();
  for (const ext of FORBIDDEN_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return {
        ok: false,
        reason: `Executable or script extension "${ext}" is prohibited in instruction-only skill packages (FR-035, NFR-026).`,
      };
    }
  }

  const matchesAllowed = Array.from(ALLOWED_EXTENSIONS).some((ext) =>
    lower.endsWith(ext)
  );
  if (!matchesAllowed) {
    return {
      ok: false,
      reason: 'Only .md and .json files are permitted in instruction-only skill packages.',
    };
  }

  return { ok: true };
}

export class SkillExportRenderer {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  async renderAndRecordExport(
    userId: string,
    artifactId: string,
    rawTarget: string
  ): Promise<
    | { ok: true; pkg: RenderedSkillPackage }
    | { ok: false; message: string; findings: ValidationFinding[] }
  > {
    const targetParse = SkillExportTargetEnum.safeParse(rawTarget);
    if (!targetParse.success) {
      return {
        ok: false,
        message: `Unsupported export target "${rawTarget}". Supported targets: claude_code_skill, codex_agents_skill.`,
        findings: [],
      };
    }
    const target = targetParse.data;

    const artRes = await this.db.query<{
      id: string;
      user_id: string;
      artifact_type: string;
    }>(
      `SELECT id, user_id, artifact_type FROM artifacts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [artifactId, userId]
    );
    if (artRes.rows.length === 0 || artRes.rows[0].artifact_type !== 'ai_skill') {
      return {
        ok: false,
        message: 'AI Skill artifact not found or access denied.',
        findings: [],
      };
    }

    const verRes = await this.db.query<{
      id: string;
      version_number: number;
      spec_json: SkillSpecPayload;
    }>(
      `SELECT sv.id, sv.version_number, sv.spec_json
       FROM skill_versions sv
       JOIN skills s ON s.current_version_id = sv.id
       WHERE s.artifact_id = $1`,
      [artifactId]
    );

    if (verRes.rows.length === 0) {
      return {
        ok: false,
        message: 'Canonical skill version record not found.',
        findings: [],
      };
    }

    const version = verRes.rows[0];
    const spec = version.spec_json;

    // Fetch source evidence to run full 5-layer validation
    const srcRes = await this.db.query<{
      id: string;
      kind: 'metadata' | 'caption' | 'transcript' | 'visual_observation' | 'user_provided';
      canonical_url: string;
    }>(
      `SELECT se.id, se.kind, s.canonical_url
       FROM artifact_sources asrc
       JOIN sources s ON s.id = asrc.source_id
       JOIN source_evidence se ON se.source_id = s.id
       WHERE asrc.artifact_id = $1`,
      [artifactId]
    );

    const validation = validateSkillSpecCandidate(
      spec,
      srcRes.rows.map((r) => ({ id: r.id, kind: r.kind }))
    );

    if (validation.status === 'invalid') {
      return {
        ok: false,
        message:
          'Canonical SkillSpec failed validation and cannot be exported until errors are resolved.',
        findings: validation.findings,
      };
    }

    const sourceUrl = srcRes.rows[0]?.canonical_url ?? 'user-provided';
    const baseDir =
      target === 'claude_code_skill'
        ? `.claude/skills/${spec.identity.name}`
        : `.agents/skills/${spec.identity.name}`;

    const skillMdPath = `${baseDir}/SKILL.md`;
    const manifestPath = `${baseDir}/manifest.json`;

    for (const p of [skillMdPath, manifestPath]) {
      const pathCheck = validateSafePackagePath(p);
      if (!pathCheck.ok) {
        return {
          ok: false,
          message: pathCheck.reason ?? 'Unsafe package path.',
          findings: [
            {
              layer: 'target_compatibility',
              severity: 'error',
              code: 'UNSAFE_ARCHIVE_PATH',
              message: pathCheck.reason ?? 'Unsafe package path.',
              field_path: p,
              step_id: null,
            },
          ],
        };
      }
    }

    const skillMdContent = renderSkillMarkdown(
      spec,
      target,
      version.version_number,
      sourceUrl
    );
    const manifestContent = JSON.stringify(
      {
        schema_version: spec.schema_version,
        renderer_version: RENDERER_VERSION,
        target,
        skill_name: spec.identity.name,
        version_number: version.version_number,
        capabilities: spec.capability_declarations,
        source_attribution: sourceUrl,
        tested_in_target: false,
      },
      null,
      2
    );

    const files: RenderedPackageFile[] = [
      {
        relativePath: skillMdPath,
        contentType: 'text/markdown',
        content: skillMdContent,
        sha256: computeSha256(skillMdContent),
      },
      {
        relativePath: manifestPath,
        contentType: 'application/json',
        content: manifestContent,
        sha256: computeSha256(manifestContent),
      },
    ];

    const packageHash = computeSha256(
      files.map((f) => `${f.relativePath}:${f.sha256}`).join('|')
    );

    const exportId = `exp_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;

    await this.db.query(
      `INSERT INTO skill_exports (
        id, skill_version_id, target, renderer_version, package_hash, validation_status, tested_in_target, findings_json, files_json
      ) VALUES ($1, $2, $3, $4, $5, 'compatible', FALSE, $6::jsonb, $7::jsonb)`,
      [
        exportId,
        version.id,
        target,
        RENDERER_VERSION,
        packageHash,
        JSON.stringify(validation.findings),
        JSON.stringify(files),
      ]
    );

    return {
      ok: true,
      pkg: {
        exportId,
        skillVersionId: version.id,
        versionNumber: version.version_number,
        target,
        rendererVersion: RENDERER_VERSION,
        packageHash,
        validationStatus: 'compatible',
        compatible: true,
        testedInTarget: false,
        testedNote:
          'Format-validated and target-compatible (instruction-only). Not executed inside a live target agent session (FR-037).',
        findings: validation.findings,
        files,
      },
    };
  }
}

function renderSkillMarkdown(
  spec: SkillSpecPayload,
  target: SkillExportTarget,
  versionNumber: number,
  sourceUrl: string
): string {
  const frontmatter =
    target === 'codex_agents_skill'
      ? [
          '---',
          `name: ${spec.identity.name}`,
          `description: ${JSON.stringify(spec.identity.summary)}`,
          'metadata:',
          `  version: "${versionNumber}"`,
          `  renderer_version: "${RENDERER_VERSION}"`,
          `  capabilities: "instruction_only"`,
          '---',
        ].join('\n')
      : [
          '---',
          `name: ${spec.identity.name}`,
          `description: ${JSON.stringify(spec.identity.summary)}`,
          `version: "${versionNumber}.0.0"`,
          '---',
        ].join('\n');

  const intendedLines = spec.intended_use.map((u) => `- ${u}`).join('\n');
  const nonUseLines = spec.non_use_conditions.map((u) => `- ${u}`).join('\n');
  const triggerLines = spec.trigger_examples
    .map((t) => `- "${t}"`)
    .join('\n');

  const inputLines =
    spec.input_contract.fields.length > 0
      ? spec.input_contract.fields
          .map(
            (f) =>
              `- \`${f.name}\` (${f.type}, ${
                f.required ? 'required' : 'optional'
              }): ${f.description}`
          )
          .join('\n')
      : '- No structured input parameters required.';

  const workflowLines = spec.workflow_steps
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((st, idx) => {
      const provTag =
        st.provenance_kind === 'inferred'
          ? '[Inferred]'
          : st.provenance_kind === 'user_edited'
            ? '[Edited by user]'
            : `[Source evidence: ${st.evidence_refs.join(', ') || 'transcript'}]`;
      const condLine = st.condition ? `\n   - *Condition:* ${st.condition}` : '';
      return `${idx + 1}. **${st.title}** ${provTag}\n   ${st.instruction}${condLine}`;
    })
    .join('\n\n');

  const verifyLines = spec.output_contract.verification_criteria
    .map((v) => `- [ ] ${v}`)
    .join('\n');

  return [
    frontmatter,
    '',
    `# ${spec.identity.title}`,
    '',
    spec.identity.description,
    '',
    '## Intended use',
    intendedLines,
    '',
    '## When not to use',
    nonUseLines,
    '',
    '## Trigger examples',
    triggerLines,
    '',
    '## Input contract',
    inputLines,
    spec.input_contract.notes ? `\n> ${spec.input_contract.notes}` : '',
    '',
    '## Ordered workflow',
    workflowLines,
    '',
    '## Output contract',
    `- **Format:** \`${spec.output_contract.format}\``,
    `- **Description:** ${spec.output_contract.description}`,
    '',
    '### Verification checklist',
    verifyLines,
    '',
    '## Provenance & capability boundary',
    `- **Capability scope:** \`${spec.capability_declarations.join(', ')}\` (instruction-only; does not execute commands or grant permissions)`,
    `- **Source attribution:** ${sourceUrl}`,
    `- **Schema / Renderer version:** \`${spec.schema_version}\` / \`${RENDERER_VERSION}\``,
    '',
  ].join('\n');
}
