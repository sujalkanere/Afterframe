import crypto from 'node:crypto';
import {
  UserSettingsSchema,
  type UserSettings,
} from '../../shared/contracts.js';
import type { DatabaseClient } from '../db/index.js';
import { computeSha256 } from '../jobs/idempotency.js';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  displayName: string | null;
  isGuest: boolean;
  settings: UserSettings;
  createdAt: string;
}

export class AuthService {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  async resolveOrCreateSession(rawToken?: string | null): Promise<{
    user: AuthenticatedUser;
    sessionToken: string;
    isNewSession: boolean;
  }> {
    if (rawToken && rawToken.trim().length >= 16) {
      const tokenHash = computeSha256(rawToken.trim());
      const res = await this.db.query<{
        id: string;
        email: string | null;
        display_name: string | null;
        is_guest: boolean;
        settings_json: UserSettings;
        created_at: string;
      }>(
        `SELECT u.id, u.email, u.display_name, u.is_guest, u.settings_json, u.created_at
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
        [tokenHash]
      );

      if (res.rows.length > 0) {
        const u = res.rows[0];
        const parsedSettings = UserSettingsSchema.safeParse(u.settings_json);
        return {
          user: {
            id: u.id,
            email: u.email,
            displayName: u.display_name,
            isGuest: u.is_guest,
            settings: parsedSettings.success
              ? parsedSettings.data
              : UserSettingsSchema.parse({}),
            createdAt: u.created_at,
          },
          sessionToken: rawToken.trim(),
          isNewSession: false,
        };
      }
    }

    // Create a fresh guest-trial user with a genuine empty library (FR-041, Section 6.8.G)
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const sessionToken = `af_sess_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = computeSha256(sessionToken);
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const defaultSettings = UserSettingsSchema.parse({});

    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO users (id, email, display_name, is_guest, settings_json)
         VALUES ($1, NULL, 'Guest researcher', TRUE, $2::jsonb)`,
        [userId, JSON.stringify(defaultSettings)]
      );

      await tx.query(
        `INSERT INTO auth_sessions (token_hash, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [tokenHash, userId, expiresAt]
      );
    });

    return {
      user: {
        id: userId,
        email: null,
        displayName: 'Guest researcher',
        isGuest: true,
        settings: defaultSettings,
        createdAt: new Date().toISOString(),
      },
      sessionToken,
      isNewSession: true,
    };
  }

  /**
   * Passwordless sign-in (FR-064, Section 6.8.G).
   * Upgrades the current guest account or signs into an existing email account.
   */
  async signInPasswordless(
    currentUserId: string,
    emailInput: string,
    displayNameInput?: string
  ): Promise<{
    ok: boolean;
    user?: AuthenticatedUser;
    sessionToken?: string;
    verificationToken?: string;
    message?: string;
  }> {
    const email = emailInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: 'Enter a valid email address.' };
    }

    const displayName =
      displayNameInput?.trim() || email.split('@')[0] || 'Researcher';
    const sessionToken = `af_sess_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = computeSha256(sessionToken);
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const user = await this.db.transaction(async (tx) => {
      const existing = await tx.query<{
        id: string;
        email: string;
        display_name: string | null;
        is_guest: boolean;
        settings_json: UserSettings;
        created_at: string;
      }>(`SELECT id, email, display_name, is_guest, settings_json, created_at FROM users WHERE email = $1`, [
        email,
      ]);

      let targetUserId: string;
      let settings: UserSettings = UserSettingsSchema.parse({});
      let createdAt = new Date().toISOString();

      if (existing.rows.length > 0) {
        targetUserId = existing.rows[0].id;
        const parsed = UserSettingsSchema.safeParse(
          existing.rows[0].settings_json
        );
        if (parsed.success) settings = parsed.data;
        createdAt = existing.rows[0].created_at;

        // Reassign any guest artifacts/jobs created in this session if currentUserId was a guest
        if (currentUserId !== targetUserId) {
          await tx.query(
            `UPDATE artifacts SET user_id = $1 WHERE user_id = $2`,
            [targetUserId, currentUserId]
          );
          await tx.query(
            `UPDATE categories SET owner_user_id = $1 WHERE owner_user_id = $2
             AND slug NOT IN (SELECT slug FROM categories WHERE owner_user_id = $1)`,
            [targetUserId, currentUserId]
          );
        }
      } else {
        targetUserId = currentUserId;
        const updated = await tx.query<{
          settings_json: UserSettings;
          created_at: string;
        }>(
          `UPDATE users
           SET email = $1,
               display_name = $2,
               is_guest = FALSE,
               updated_at = NOW()
           WHERE id = $3
           RETURNING settings_json, created_at`,
          [email, displayName, currentUserId]
        );
        if (updated.rows.length > 0) {
          const parsed = UserSettingsSchema.safeParse(
            updated.rows[0].settings_json
          );
          if (parsed.success) settings = parsed.data;
          createdAt = updated.rows[0].created_at;
        }
      }

      await tx.query(
        `INSERT INTO auth_sessions (token_hash, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [tokenHash, targetUserId, expiresAt]
      );

      return {
        id: targetUserId,
        email,
        displayName,
        isGuest: false,
        settings,
        createdAt,
      };
    });

    return {
      ok: true,
      user,
      sessionToken,
    };
  }

  async updateSettings(
    userId: string,
    partial: Partial<UserSettings>
  ): Promise<UserSettings> {
    const curRes = await this.db.query<{ settings_json: UserSettings }>(
      `SELECT settings_json FROM users WHERE id = $1`,
      [userId]
    );
    const current = UserSettingsSchema.safeParse(
      curRes.rows[0]?.settings_json ?? {}
    );
    const merged = UserSettingsSchema.parse({
      ...(current.success ? current.data : {}),
      ...partial,
    });

    await this.db.query(
      `UPDATE users SET settings_json = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(merged), userId]
    );

    return merged;
  }

  /**
   * Exports all structured user data in a documented JSON format (FR-058, FR-064).
   */
  async exportUserData(userId: string) {
    const userRes = await this.db.query(
      `SELECT id, email, display_name, is_guest, settings_json, created_at FROM users WHERE id = $1`,
      [userId]
    );
    const sourcesRes = await this.db.query(
      `SELECT id, platform, submitted_url, canonical_url, platform_content_id, metadata_json, created_at
       FROM sources WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    const artifactsRes = await this.db.query(
      `SELECT id, artifact_type, title, description, status, provenance_mode, created_at, updated_at
       FROM artifacts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
      [userId]
    );
    const tasksRes = await this.db.query(
      `SELECT t.artifact_id, t.deadline, t.completion_status, t.estimated_minutes
       FROM tasks t JOIN artifacts a ON a.id = t.artifact_id WHERE a.user_id = $1`,
      [userId]
    );
    const stepsRes = await this.db.query(
      `SELECT ts.*
       FROM task_steps ts JOIN artifacts a ON a.id = ts.task_artifact_id
       WHERE a.user_id = $1 ORDER BY ts.task_artifact_id, ts.position ASC`,
      [userId]
    );
    const skillVersionsRes = await this.db.query(
      `SELECT sv.*
       FROM skill_versions sv JOIN artifacts a ON a.id = sv.skill_artifact_id
       WHERE a.user_id = $1 ORDER BY sv.skill_artifact_id, sv.version_number ASC`,
      [userId]
    );
    const categoriesRes = await this.db.query(
      `SELECT id, name, slug, created_at FROM categories WHERE owner_user_id = $1 ORDER BY slug ASC`,
      [userId]
    );
    const evidenceRes = await this.db.query(
      `SELECT se.*
       FROM source_evidence se JOIN sources s ON s.id = se.source_id
       WHERE s.user_id = $1 ORDER BY se.created_at ASC`,
      [userId]
    );

    return {
      export_format: 'afterframe.user_data.v1.1',
      exported_at: new Date().toISOString(),
      retention_policy: {
        temporary_media:
          'Deleted immediately after processing stage completion or failure (0 days retained).',
        unconfirmed_candidates:
          'Retained for 7 days in Ready for Review, then automatically expired.',
        confirmed_artifacts_and_evidence:
          'Retained while referenced by at least one active artifact owned by the user; purged after the 10-second undo window when the last referencing artifact or account is deleted.',
      },
      user: userRes.rows[0] ?? null,
      sources: sourcesRes.rows,
      source_evidence: evidenceRes.rows,
      categories: categoriesRes.rows,
      artifacts: artifactsRes.rows,
      tasks: tasksRes.rows,
      task_steps: stepsRes.rows,
      skill_versions: skillVersionsRes.rows,
    };
  }

  /**
   * Deletes the user's account and all owned sources, evidence, jobs, and artifacts (FR-064, Section 6.8.H).
   */
  async deleteAccountAndData(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query(
        `DELETE FROM evidence_links WHERE artifact_id IN (SELECT id FROM artifacts WHERE user_id = $1)`,
        [userId]
      );
      await tx.query(
        `DELETE FROM artifact_sources WHERE artifact_id IN (SELECT id FROM artifacts WHERE user_id = $1)`,
        [userId]
      );
      await tx.query(`DELETE FROM artifacts WHERE user_id = $1`, [userId]);
      await tx.query(
        `DELETE FROM source_evidence WHERE source_id IN (SELECT id FROM sources WHERE user_id = $1)`,
        [userId]
      );
      await tx.query(`DELETE FROM processing_jobs WHERE user_id = $1`, [userId]);
      await tx.query(`DELETE FROM sources WHERE user_id = $1`, [userId]);
      await tx.query(`DELETE FROM users WHERE id = $1`, [userId]);
    });
  }
}
