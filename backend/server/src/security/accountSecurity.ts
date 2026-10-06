import crypto from "node:crypto";
import type { Request } from "express";
import { db } from "../config/db.js";

export type AccountSecurityStatus = "active" | "restricted" | "blocked";

const INSTALLATION_HEADER = "x-splitverse-installation-id";
const PLATFORM_HEADER = "x-splitverse-platform";

function cleanInstallationId(value: unknown) {
  const candidate = String(value ?? "").trim();
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(candidate)) return "";
  return candidate;
}

export function getInstallationHash(req: Request) {
  const installationId = cleanInstallationId(req.header(INSTALLATION_HEADER));
  if (!installationId) return null;
  return crypto.createHash("sha256").update(installationId).digest("hex");
}

function getPlatform(req: Request) {
  const value = String(req.header(PLATFORM_HEADER) || "unknown").trim().toLowerCase();
  return /^[a-z0-9._-]{1,32}$/.test(value) ? value : "unknown";
}

export async function getSecurityStateByFirebaseUid(firebaseUid: string) {
  const result = await db.query<{
    user_id: string;
    status: AccountSecurityStatus;
    reason: string | null;
    updated_at: string | null;
  }>(
    `
      SELECT
        u.id AS user_id,
        COALESCE(s.status, 'active')::text AS status,
        s.reason,
        s.updated_at
      FROM users u
      LEFT JOIN user_security_states s ON s.user_id = u.id
      WHERE u.firebase_uid = $1
      LIMIT 1
    `,
    [firebaseUid],
  );

  return result.rows[0] ?? null;
}

export async function registerInstallationForUser(userId: string, req: Request) {
  const installationHash = getInstallationHash(req);
  if (!installationHash) {
    return { installationHash: null, restrictedInstallation: false };
  }

  const platform = getPlatform(req);
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const installation = await client.query<{
      restricted_at: string | null;
      restricted_reason: string | null;
    }>(
      `
        INSERT INTO client_installations (
          installation_hash, platform, first_seen_at, last_seen_at
        ) VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (installation_hash)
        DO UPDATE SET
          platform = EXCLUDED.platform,
          last_seen_at = NOW()
        RETURNING restricted_at, restricted_reason
      `,
      [installationHash, platform],
    );

    await client.query(
      `
        INSERT INTO user_installation_links (
          user_id, installation_hash, first_seen_at, last_seen_at
        ) VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (user_id, installation_hash)
        DO UPDATE SET last_seen_at = NOW()
      `,
      [userId, installationHash],
    );

    const restrictedInstallation = Boolean(installation.rows[0]?.restricted_at);

    if (restrictedInstallation) {
      const existingState = await client.query<{ status: AccountSecurityStatus }>(
        `SELECT status FROM user_security_states WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );

      if (existingState.rows[0]?.status !== "blocked") {
        await client.query(
          `
            INSERT INTO user_security_states (user_id, status, reason, updated_at)
            VALUES ($1, 'restricted', $2, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
              status = CASE WHEN user_security_states.status = 'blocked' THEN 'blocked' ELSE 'restricted' END,
              reason = CASE WHEN user_security_states.status = 'blocked' THEN user_security_states.reason ELSE EXCLUDED.reason END,
              updated_at = NOW()
          `,
          [userId, "Known installation previously associated with a blocked account; admin review required."],
        );
      }

      const related = await client.query<{ user_id: string }>(
        `
          SELECT link.user_id
          FROM user_installation_links link
          JOIN user_security_states state ON state.user_id = link.user_id
          WHERE link.installation_hash = $1
          AND state.status = 'blocked'
          AND link.user_id <> $2
          ORDER BY state.updated_at DESC
          LIMIT 1
        `,
        [installationHash, userId],
      );

      await client.query(
        `
          INSERT INTO security_events (
            event_type, user_id, related_user_id, installation_hash, metadata
          ) VALUES ('POTENTIAL_BAN_EVASION', $1, $2, $3, $4::jsonb)
        `,
        [
          userId,
          related.rows[0]?.user_id ?? null,
          installationHash,
          JSON.stringify({ platform, signal: "restricted_installation" }),
        ],
      );
    }

    await client.query("COMMIT");
    return { installationHash, restrictedInstallation };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
