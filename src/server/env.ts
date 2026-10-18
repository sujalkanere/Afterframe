import fs from 'node:fs';
import path from 'node:path';

/**
 * Lightweight .env loader that parses KEY=VALUE lines
 * without overwriting variables already present in process.env.
 */
export function loadEnvFile(envPath?: string): void {
  const targetPath =
    envPath ?? path.resolve(process.cwd(), '.env');

  if (!fs.existsSync(targetPath)) {
    return;
  }

  try {
    const content = fs.readFileSync(targetPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Skip empty lines or comments
      if (!line || line.startsWith('#')) {
        continue;
      }

      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }

      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();

      // Strip enclosing single or double quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.warn(`Warning: Could not load .env file from ${targetPath}:`, err);
  }
}
