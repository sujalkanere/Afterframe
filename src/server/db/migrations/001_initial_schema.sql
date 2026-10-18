-- Afterframe Canonical PostgreSQL Schema (v1.1.0)
-- Enforces Section 7.2 entities and Section 7.4 relational invariants.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  settings_json JSONB NOT NULL DEFAULT '{"theme":"dark","reduced_motion":false,"content_language":"auto","timezone":"UTC"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'manual')),
  submitted_url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  platform_content_id TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform, platform_content_id)
);

CREATE TABLE IF NOT EXISTS source_evidence (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('metadata', 'caption', 'transcript', 'visual_observation', 'user_provided')),
  content_ref TEXT,
  content_text TEXT NOT NULL,
  start_ms INTEGER CHECK (start_ms IS NULL OR start_ms >= 0),
  end_ms INTEGER CHECK (end_ms IS NULL OR (start_ms IS NOT NULL AND end_ms >= start_ms)),
  language TEXT,
  content_hash TEXT NOT NULL,
  provenance TEXT NOT NULL,
  limitations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'acquiring', 'transcribing', 'analyzing', 'needs_review', 'completed', 'failed', 'cancelled')),
  current_stage TEXT NOT NULL CHECK (current_stage IN ('queued', 'acquiring', 'transcribing', 'analyzing', 'needs_review')),
  failed_stage TEXT CHECK (failed_stage IS NULL OR failed_stage IN ('acquiring', 'transcribing', 'analyzing')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  idempotency_key TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  last_error_code TEXT,
  last_error_message TEXT,
  confirmed_artifact_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS processing_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('acquiring', 'transcribing', 'analyzing')),
  pipeline_version TEXT NOT NULL,
  provider_id TEXT,
  model_id TEXT,
  schema_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  token_usage_json JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  error_code TEXT,
  safe_error_details TEXT
);

CREATE TABLE IF NOT EXISTS extraction_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES processing_runs(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
  candidate_type TEXT NOT NULL CHECK (candidate_type IN ('task', 'ai_skill')),
  recommended_type TEXT NOT NULL CHECK (recommended_type IN ('task', 'ai_skill')),
  recommendation_reason TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('valid', 'warnings', 'invalid')),
  repair_attempts INTEGER NOT NULL DEFAULT 0 CHECK (repair_attempts >= 0),
  findings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_runs (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES extraction_results(id) ON DELETE CASCADE,
  validator_version TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('valid', 'warnings', 'invalid')),
  findings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('task', 'ai_skill', 'plan', 'habit', 'tip_reference')),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) >= 1),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'pending_delete')),
  provenance_mode TEXT NOT NULL DEFAULT 'model_extracted' CHECK (provenance_mode IN ('model_extracted', 'user_edited', 'user_created')),
  deleted_at TIMESTAMPTZ,
  delete_undo_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  artifact_id TEXT PRIMARY KEY REFERENCES artifacts(id) ON DELETE CASCADE,
  deadline TIMESTAMPTZ,
  completion_status TEXT NOT NULL DEFAULT 'todo' CHECK (completion_status IN ('todo', 'in_progress', 'completed')),
  estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes > 0)
);

CREATE TABLE IF NOT EXISTS task_steps (
  id TEXT PRIMARY KEY,
  task_artifact_id TEXT NOT NULL REFERENCES tasks(artifact_id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) >= 1),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'completed')),
  provenance_kind TEXT NOT NULL DEFAULT 'transcript' CHECK (provenance_kind IN ('transcript', 'visual', 'inferred', 'user_edited')),
  is_inferred BOOLEAN NOT NULL DEFAULT FALSE,
  is_user_edited BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (task_artifact_id, position)
);

CREATE TABLE IF NOT EXISTS skills (
  artifact_id TEXT PRIMARY KEY REFERENCES artifacts(id) ON DELETE CASCADE,
  current_version_id TEXT
);

CREATE TABLE IF NOT EXISTS skill_versions (
  id TEXT PRIMARY KEY,
  skill_artifact_id TEXT NOT NULL REFERENCES skills(artifact_id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  schema_version TEXT NOT NULL,
  spec_json JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (skill_artifact_id, version_number)
);

CREATE TABLE IF NOT EXISTS artifact_sources (
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  processing_run_id TEXT REFERENCES processing_runs(id) ON DELETE SET NULL,
  relationship_kind TEXT NOT NULL DEFAULT 'derived_from',
  PRIMARY KEY (artifact_id, source_id)
);

CREATE TABLE IF NOT EXISTS evidence_links (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES source_evidence(id) ON DELETE RESTRICT,
  step_id TEXT,
  relationship_kind TEXT NOT NULL DEFAULT 'supports',
  provenance_label TEXT NOT NULL DEFAULT 'transcript'
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (slug NOT IN ('short_term', 'short-term', 'task', 'ai_skill', 'ai-skill', 'plan', 'habit', 'tip_reference')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, slug)
);

CREATE TABLE IF NOT EXISTS artifact_categories (
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (artifact_id, category_id)
);

CREATE TABLE IF NOT EXISTS skill_exports (
  id TEXT PRIMARY KEY,
  skill_version_id TEXT NOT NULL REFERENCES skill_versions(id) ON DELETE CASCADE,
  target TEXT NOT NULL CHECK (target IN ('claude_code_skill', 'codex_agents_skill')),
  renderer_version TEXT NOT NULL,
  package_hash TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('valid', 'compatible', 'invalid')),
  tested_in_target BOOLEAN NOT NULL DEFAULT FALSE,
  findings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  files_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operational_metrics (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  stage TEXT,
  platform TEXT,
  status TEXT,
  duration_ms INTEGER,
  error_code TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for full-text search (Section 8.4), keyset pagination (NFR-008), and graph adjacency (Section 8.3)
CREATE INDEX IF NOT EXISTS idx_artifacts_fts_gin
  ON artifacts
  USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));

CREATE INDEX IF NOT EXISTS idx_artifacts_user_active_created
  ON artifacts (user_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND status != 'pending_delete';

CREATE INDEX IF NOT EXISTS idx_artifacts_user_type_created
  ON artifacts (user_id, artifact_type, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND status != 'pending_delete';

CREATE INDEX IF NOT EXISTS idx_artifact_categories_category
  ON artifact_categories (category_id, artifact_id);

CREATE INDEX IF NOT EXISTS idx_artifact_sources_source
  ON artifact_sources (source_id, artifact_id);

CREATE INDEX IF NOT EXISTS idx_evidence_links_artifact
  ON evidence_links (artifact_id, step_id);

CREATE INDEX IF NOT EXISTS idx_source_evidence_source_time
  ON source_evidence (source_id, start_ms ASC NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_status
  ON processing_jobs (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_extraction_results_job
  ON extraction_results (job_id, created_at DESC);
