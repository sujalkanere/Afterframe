const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{12,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /(api[_-]?key|token|secret|password|cookie|authorization)\s*[:=]\s*["']?[^\s"',;}{]{6,}["']?/gi,
];

/**
 * Redacts credentials, tokens, cookies, and configured environment secrets from
 * error strings and operational logs (NFR-004, NFR-020, Section 10.3).
 */
export function sanitizeErrorDetails(raw: unknown): string {
  const text =
    raw instanceof Error
      ? `${raw.name}: ${raw.message}`
      : typeof raw === 'string'
        ? raw
        : JSON.stringify(raw ?? 'Unknown error');

  let sanitized = text;

  // Redact any known secret environment variable values
  const secretEnvKeys = [
    'LLM_API_KEY',
    'YOUTUBE_API_KEY',
    'TRANSCRIPTION_API_KEY',
    'DATABASE_URL',
    'SESSION_SECRET',
    'GITHUB_TOKEN',
    'GH_TOKEN',
  ];

  for (const key of secretEnvKeys) {
    const val = process.env[key];
    if (val && val.length >= 6) {
      sanitized = sanitized.split(val).join('[REDACTED_ENV_SECRET]');
    }
  }

  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // Strip multi-line stack traces and cap length
  const firstLine = sanitized.split('\n')[0].trim();
  return firstLine.slice(0, 500);
}
