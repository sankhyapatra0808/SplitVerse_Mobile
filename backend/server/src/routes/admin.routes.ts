import { Router } from "express";
import { z } from "zod";
import { db } from "../config/db.js";
import { adminAuth } from "../config/firebaseAdmin.js";
import { sendLiveUpdate } from "../liveEvents.js";
import { verifyFirebaseToken, type AuthRequest } from "../middleware/verifyFirebaseToken.js";
import { getAdminIdentity, isAdminRequest, isConfiguredAdminEmail, requireAdmin } from "../middleware/requireAdmin.js";
import { loadNetDebtLines, serializeNetSettlements } from "./splitRooms.routes.js";

const router = Router();

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).default(""),
});

const accountSecuritySchema = z.object({
  status: z.enum(["active", "restricted", "blocked"]),
  reason: z.string().trim().min(3).max(500),
});

const settlementReversalSchema = z.object({
  refundMode: z.enum(["wallet_refund", "external_refund"]),
  reason: z.string().trim().min(5).max(500),
});

const configKeys = new Set([
  "android_latest_version",
  "android_minimum_version",
  "android_force_update",
  "android_update_url",
  "android_release_notes",
  "maintenance_enabled",
  "maintenance_message",
]);

function normalizeJson(value: unknown) {
  return value === undefined ? null : value;
}

async function getDbUserByFirebaseUid(firebaseUid: string) {
  const result = await db.query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE firebase_uid = $1 LIMIT 1`,
    [firebaseUid],
  );
  return result.rows[0] ?? null;
}

async function writeAudit(
  req: AuthRequest,
  action: string,
  targetType: string,
  targetId: string | null,
  reason: string | null,
  beforeValue: unknown,
  afterValue: unknown,
  metadata: Record<string, unknown> = {},
) {
  const identity = getAdminIdentity(req);
  const dbUser = identity.firebaseUid
    ? await getDbUserByFirebaseUid(identity.firebaseUid)
    : null;

  await db.query(
    `
      INSERT INTO admin_audit_logs (
        admin_user_id, admin_email, action, target_type, target_id,
        reason, before_value, after_value, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)
    `,
    [
      dbUser?.id ?? null,
      identity.email,
      action,
      targetType,
      targetId,
      reason,
      JSON.stringify(normalizeJson(beforeValue)),
      JSON.stringify(normalizeJson(afterValue)),
      JSON.stringify(metadata),
    ],
  );
}

router.get("/access", verifyFirebaseToken, (req: AuthRequest, res) => {
  return res.json({ isAdmin: isAdminRequest(req) });
});

router.use(verifyFirebaseToken, requireAdmin);

router.get("/overview", async (_req, res) => {
  try {
    const [users, rooms, expenses, settlements, activity, versions] = await Promise.all([
      db.query(`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '6 days')::int AS week
        FROM users
      `),
      db.query(`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today,
          COUNT(*) FILTER (WHERE archived_at IS NULL)::int AS active,
          COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived
        FROM split_rooms
      `),
      db.query(`
        SELECT COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today,
          COALESCE(SUM(amount),0)::float AS value
        FROM split_room_items
      `),
      db.query(`
        SELECT COUNT(*)::int AS count,
          COALESCE(SUM(amount),0)::float AS recorded_amount,
          COUNT(*) FILTER (WHERE method='manual')::int AS manual_count,
          COUNT(*) FILTER (WHERE method='wallet')::int AS wallet_count,
          COUNT(*) FILTER (WHERE method='offset')::int AS offset_count
        FROM split_room_item_settlements
      `),
      db.query(`
        SELECT * FROM (
          SELECT 'user_registered' AS type, id::text AS id, COALESCE(name,email) AS label, created_at FROM users
          UNION ALL
          SELECT 'room_created', id::text, name, created_at FROM split_rooms
          UNION ALL
          SELECT 'settlement_recorded', id::text, method || ' settlement', created_at FROM split_room_item_settlements
          UNION ALL
          SELECT 'admin_action', id::text, action, created_at FROM admin_audit_logs
        ) events
        ORDER BY created_at DESC
        LIMIT 12
      `),
      db.query(`SELECT key, value FROM app_configuration WHERE key LIKE 'android_%' OR key LIKE 'maintenance_%'`),
    ]);

    const config = Object.fromEntries(versions.rows.map((row) => [row.key, row.value]));
    res.json({
      users: users.rows[0],
      rooms: rooms.rows[0],
      expenses: { ...expenses.rows[0], currency: "INR" },
      settlements: { ...settlements.rows[0], currency: "INR" },
      app: config,
      recentActivity: activity.rows,
    });
  } catch (error) {
    console.error("Admin overview failed:", error);
    res.status(500).json({ message: "Failed to load admin overview" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const { page, limit, search } = pageSchema.parse(req.query);
    const offset = (page - 1) * limit;
    const term = `%${search.toLowerCase()}%`;
    const where = search
      ? `WHERE LOWER(COALESCE(u.name,'')) LIKE $3 OR LOWER(COALESCE(u.username,'')) LIKE $3 OR LOWER(u.email) LIKE $3 OR u.id::text = $4`
      : "";
    const values: unknown[] = search ? [limit, offset, term, search] : [limit, offset];
    const result = await db.query(
      `
      SELECT u.id, u.name, u.username, u.email, u.provider, u.created_at, u.updated_at,
        (u.wallet_pin_hash IS NOT NULL) AS has_wallet_pin,
        COALESCE(security.status, 'active') AS account_status,
        security.updated_at AS security_updated_at,
        (SELECT COUNT(*)::int FROM split_room_members m WHERE m.user_id=u.id) AS room_count,
        (SELECT COUNT(*)::int FROM friendships f WHERE f.user_one_id=u.id OR f.user_two_id=u.id) AS friend_count,
        COUNT(*) OVER()::int AS total_count
      FROM users u
      LEFT JOIN user_security_states security ON security.user_id = u.id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      values,
    );
    res.json({
      users: result.rows.map(({ total_count: _total, ...row }) => row),
      page,
      limit,
      total: Number(result.rows[0]?.total_count || 0),
    });
  } catch (error) {
    console.error("Admin users failed:", error);
    res.status(500).json({ message: "Failed to load users" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const [user, stats, rooms, settlements, installations, securityEvents] = await Promise.all([
      db.query(`
        SELECT u.id, u.firebase_uid, u.name, u.username, u.email, u.provider, u.created_at, u.updated_at,
          u.app_currency, u.app_language, u.avatar_mode,
          (u.wallet_pin_hash IS NOT NULL) AS has_wallet_pin, u.wallet_pin_updated_at,
          COALESCE(security.status, 'active') AS account_status,
          security.reason AS security_reason,
          security.updated_at AS security_updated_at,
          security_admin.email AS security_updated_by_email
        FROM users u
        LEFT JOIN user_security_states security ON security.user_id = u.id
        LEFT JOIN users security_admin ON security_admin.id = security.updated_by_admin_user_id
        WHERE u.id=$1
      `, [id]),
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM split_rooms WHERE owner_user_id=$1)::int AS rooms_created,
          (SELECT COUNT(*) FROM split_room_members WHERE user_id=$1)::int AS rooms_joined,
          (SELECT COUNT(*) FROM split_room_items WHERE created_by_user_id=$1)::int AS items_created,
          (SELECT COUNT(*) FROM friendships WHERE user_one_id=$1 OR user_two_id=$1)::int AS friends,
          (SELECT COUNT(*) FROM split_room_item_settlements WHERE created_by_user_id=$1 AND method <> 'admin_reversal')::int AS settlements_recorded
      `, [id]),
      db.query(`
        SELECT r.id, r.name, r.created_at, r.archived_at, m.role
        FROM split_room_members m JOIN split_rooms r ON r.id=m.room_id
        WHERE m.user_id=$1 ORDER BY r.created_at DESC LIMIT 20
      `, [id]),
      db.query(`
        SELECT
          s.id,
          s.amount::float,
          s.method,
          s.created_at,
          i.room_id,
          r.name AS room_name,
          i.title AS item_title,
          COALESCE(member_user.id, member.user_id) AS payer_user_id,
          COALESCE(member_user.name, member.display_name) AS payer_name,
          COALESCE(member_user.email, member.email) AS payer_email,
          receiver.id AS receiver_user_id,
          receiver.name AS receiver_name,
          receiver.email AS receiver_email,
          reversal.id AS reversal_id,
          reversal.refund_mode AS reversal_refund_mode,
          reversal.created_at AS reversed_at
        FROM split_room_item_settlements s
        JOIN split_room_items i ON i.id=s.item_id
        JOIN split_rooms r ON r.id=i.room_id
        JOIN split_room_members member ON member.id=i.assigned_member_id
        LEFT JOIN users member_user ON member_user.id=member.user_id OR (member.user_id IS NULL AND member.email IS NOT NULL AND LOWER(member_user.email)=LOWER(member.email))
        JOIN users receiver ON receiver.id=COALESCE(i.paid_by_user_id,r.paid_by_user_id,r.owner_user_id)
        LEFT JOIN admin_settlement_reversals reversal ON reversal.original_settlement_id=s.id
        WHERE s.method IN ('wallet','manual')
        AND (COALESCE(member_user.id, member.user_id)=$1 OR receiver.id=$1)
        ORDER BY s.created_at DESC LIMIT 30
      `, [id]),
      db.query(`
        SELECT
          installation.platform,
          link.first_seen_at,
          link.last_seen_at,
          (installation.restricted_at IS NOT NULL) AS restricted,
          installation.restricted_at
        FROM user_installation_links link
        JOIN client_installations installation ON installation.installation_hash=link.installation_hash
        WHERE link.user_id=$1
        ORDER BY link.last_seen_at DESC
        LIMIT 20
      `, [id]),
      db.query(`
        SELECT event_type, metadata, created_at
        FROM security_events
        WHERE user_id=$1 OR related_user_id=$1
        ORDER BY created_at DESC
        LIMIT 20
      `, [id]),
    ]);
    if (!user.rows[0]) return res.status(404).json({ message: "User not found" });
    res.json({
      user: user.rows[0],
      stats: stats.rows[0],
      rooms: rooms.rows,
      settlements: settlements.rows,
      installations: installations.rows,
      securityEvents: securityEvents.rows,
    });
  } catch (error) {
    console.error("Admin user detail failed:", error);
    res.status(500).json({ message: "Failed to load user" });
  }
});

router.post("/users/:id/security-status", async (req: AuthRequest, res) => {
  const client = await db.connect();

  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = accountSecuritySchema.parse(req.body);
    const identity = getAdminIdentity(req);
    const adminUser = await getDbUserByFirebaseUid(identity.firebaseUid);

    await client.query("BEGIN");

    const targetResult = await client.query<{
      id: string;
      firebase_uid: string;
      email: string;
      name: string | null;
      account_status: string;
      security_reason: string | null;
    }>(
      `
        SELECT
          u.id, u.firebase_uid, u.email, u.name,
          COALESCE(security.status, 'active') AS account_status,
          security.reason AS security_reason
        FROM users u
        LEFT JOIN user_security_states security ON security.user_id=u.id
        WHERE u.id=$1
        FOR UPDATE OF u
      `,
      [id],
    );
    const target = targetResult.rows[0];

    if (!target) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    if (isConfiguredAdminEmail(target.email)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Configured administrator accounts cannot be restricted from this control." });
    }

    await client.query(
      `
        INSERT INTO user_security_states (
          user_id, status, reason, updated_by_admin_user_id, updated_at
        ) VALUES ($1,$2,$3,$4,NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          status=EXCLUDED.status,
          reason=EXCLUDED.reason,
          updated_by_admin_user_id=EXCLUDED.updated_by_admin_user_id,
          updated_at=NOW()
      `,
      [id, body.status, body.reason, adminUser?.id ?? null],
    );

    if (body.status === "blocked") {
      await client.query(
        `
          UPDATE client_installations installation
          SET restricted_at=COALESCE(restricted_at,NOW()), restricted_reason=$2
          WHERE installation.installation_hash IN (
            SELECT installation_hash FROM user_installation_links WHERE user_id=$1
          )
        `,
        [id, `Associated with blocked SplitVerse account ${id}`],
      );
    }

    if (body.status === "active") {
      await client.query(
        `
          UPDATE client_installations installation
          SET restricted_at=NULL, restricted_reason=NULL
          WHERE installation.installation_hash IN (
            SELECT installation_hash FROM user_installation_links WHERE user_id=$1
          )
          AND NOT EXISTS (
            SELECT 1
            FROM user_installation_links other_link
            JOIN user_security_states other_state ON other_state.user_id=other_link.user_id
            WHERE other_link.installation_hash=installation.installation_hash
            AND other_link.user_id<>$1
            AND other_state.status='blocked'
          )
        `,
        [id],
      );
    }

    await client.query(
      `
        INSERT INTO security_events (event_type,user_id,metadata)
        VALUES ($1,$2,$3::jsonb)
      `,
      [
        body.status === "blocked" ? "ACCOUNT_BLOCKED" : body.status === "restricted" ? "ACCOUNT_RESTRICTED" : "ACCOUNT_RESTORED",
        id,
        JSON.stringify({ adminEmail: identity.email, reason: body.reason }),
      ],
    );

    await client.query(
      `
        INSERT INTO admin_audit_logs (
          admin_user_id, admin_email, action, target_type, target_id,
          reason, before_value, after_value, metadata
        ) VALUES ($1,$2,$3,'user',$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)
      `,
      [
        adminUser?.id ?? null,
        identity.email,
        body.status === "blocked" ? "USER_BLOCKED" : body.status === "restricted" ? "USER_RESTRICTED" : "USER_RESTORED",
        id,
        body.reason,
        JSON.stringify({ status: target.account_status, reason: target.security_reason }),
        JSON.stringify({ status: body.status, reason: body.reason }),
        JSON.stringify({ firebaseUid: target.firebase_uid }),
      ],
    );

    await client.query("COMMIT");

    if (body.status !== "active") {
      await adminAuth.revokeRefreshTokens(target.firebase_uid).catch((error) => {
        console.error("Failed to revoke Firebase refresh tokens for restricted account:", error);
      });
    }

    sendLiveUpdate([id], { type: "security", reason: `account-${body.status}` });

    return res.json({
      message: body.status === "active" ? "Account restored" : body.status === "restricted" ? "Account restricted" : "Account blocked",
      status: body.status,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Admin account security update failed:", error);
    return res.status(400).json({ message: "Could not update account security status" });
  } finally {
    client.release();
  }
});

router.get("/rooms", async (req, res) => {
  try {
    const { page, limit, search } = pageSchema.parse(req.query);
    const offset = (page - 1) * limit;
    const term = `%${search.toLowerCase()}%`;
    const values: unknown[] = search ? [limit, offset, term, search] : [limit, offset];
    const where = search ? `WHERE LOWER(r.name) LIKE $3 OR r.id::text=$4 OR LOWER(owner.email) LIKE $3 OR EXISTS (SELECT 1 FROM split_room_members sm WHERE sm.room_id=r.id AND LOWER(COALESCE(sm.email,'')) LIKE $3)` : "";
    const result = await db.query(`
      SELECT r.id, r.name, r.category, r.payment_status, r.created_at, r.archived_at,
        owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email,
        (SELECT COUNT(*)::int FROM split_room_members m WHERE m.room_id=r.id) AS member_count,
        (SELECT COUNT(*)::int FROM split_room_items i WHERE i.room_id=r.id) AS item_count,
        (SELECT COALESCE(SUM(i.amount),0)::float FROM split_room_items i WHERE i.room_id=r.id) AS tracked_amount,
        (SELECT COALESCE(SUM(GREATEST(i.amount-COALESCE(s.settled,0),0)),0)::float
         FROM split_room_items i LEFT JOIN (SELECT item_id,SUM(amount) settled FROM split_room_item_settlements GROUP BY item_id) s ON s.item_id=i.id
         WHERE i.room_id=r.id AND i.collected_at IS NULL) AS outstanding_amount,
        COUNT(*) OVER()::int AS total_count
      FROM split_rooms r JOIN users owner ON owner.id=r.owner_user_id
      ${where}
      ORDER BY r.created_at DESC LIMIT $1 OFFSET $2
    `, values);
    res.json({ rooms: result.rows.map(({total_count:_t,...row})=>row), page, limit, total:Number(result.rows[0]?.total_count||0), currency:"INR" });
  } catch (error) {
    console.error("Admin rooms failed:", error);
    res.status(500).json({ message: "Failed to load rooms" });
  }
});

router.get("/rooms/:id", async (req, res) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const [room, members, items, settlementHistory] = await Promise.all([
      db.query(`SELECT r.*, u.name AS owner_name, u.email AS owner_email FROM split_rooms r JOIN users u ON u.id=r.owner_user_id WHERE r.id=$1`, [id]),
      db.query(`SELECT m.id,m.user_id,m.display_name,m.email,m.role,m.status,m.created_at,u.name,u.username FROM split_room_members m LEFT JOIN users u ON u.id=m.user_id WHERE m.room_id=$1 ORDER BY m.created_at`, [id]),
      db.query(`
        SELECT i.id,i.title,i.amount::float,i.created_at,i.collected_at,i.expense_id,i.split_group_id,
          debtor.id AS debtor_user_id, COALESCE(debtor.name,m.display_name) AS assigned_to, COALESCE(debtor.email,m.email) AS assigned_email,
          payer.id AS paid_by_user_id,payer.name AS paid_by_name,payer.email AS paid_by_email,
          COALESCE(s.settled_amount,0)::float AS settled_amount,
          GREATEST(i.amount-COALESCE(s.settled_amount,0),0)::float AS pending_amount
        FROM split_room_items i
        JOIN split_room_members m ON m.id=i.assigned_member_id
        JOIN split_rooms r ON r.id=i.room_id
        LEFT JOIN users debtor ON debtor.id=m.user_id OR (m.user_id IS NULL AND m.email IS NOT NULL AND LOWER(debtor.email)=LOWER(m.email))
        JOIN users payer ON payer.id=COALESCE(i.paid_by_user_id,r.paid_by_user_id,r.owner_user_id)
        LEFT JOIN (SELECT item_id,SUM(amount) settled_amount FROM split_room_item_settlements GROUP BY item_id) s ON s.item_id=i.id
        WHERE i.room_id=$1 ORDER BY i.created_at
      `,[id]),
      db.query(`
        SELECT s.id,s.item_id,s.amount::float,s.method,s.counter_item_id,s.wallet_transaction_id,s.created_by_user_id,s.created_at
        FROM split_room_item_settlements s JOIN split_room_items i ON i.id=s.item_id
        WHERE i.room_id=$1 ORDER BY s.created_at
      `,[id]),
    ]);
    if (!room.rows[0]) return res.status(404).json({message:"Room not found"});
    res.json({room:room.rows[0],members:members.rows,items:items.rows,settlements:settlementHistory.rows,currency:"INR"});
  } catch (error) {
    console.error("Admin room detail failed:", error);
    res.status(500).json({ message: "Failed to load room" });
  }
});

router.get("/settlement-debugger/:roomId", async (req, res) => {
  try {
    const roomId = z.string().uuid().parse(req.params.roomId);
    const userId = z.string().uuid().parse(req.query.userId);
    const allLines = await loadNetDebtLines(db, userId);
    const settlements = serializeNetSettlements(allLines, userId);
    const roomLines = allLines.filter((line) => line.room_id === roomId);
    const roomResult = await db.query(`SELECT id,name,created_at FROM split_rooms WHERE id=$1`,[roomId]);
    const userResult = await db.query(`SELECT id,name,username,email FROM users WHERE id=$1`,[userId]);
    if (!roomResult.rows[0]) return res.status(404).json({message:"Room not found"});
    if (!userResult.rows[0]) return res.status(404).json({message:"User not found"});
    res.json({
      room: roomResult.rows[0],
      user: userResult.rows[0],
      roomDebtLines: roomLines,
      canonicalNetSettlements: settlements,
      roomNet: Math.round(roomLines.reduce((sum,line)=> sum + (line.debtor_user_id===userId ? -Number(line.pending_amount) : Number(line.pending_amount)),0)*100)/100,
      currency:"INR",
      source:"canonical-split-room-settlement-service",
    });
  } catch (error) {
    console.error("Admin settlement debugger failed:", error);
    res.status(500).json({ message: "Failed to calculate settlement trace" });
  }
});

router.post("/settlements/:id/reverse", async (req: AuthRequest, res) => {
  const client = await db.connect();

  try {
    const settlementId = z.string().uuid().parse(req.params.id);
    const body = settlementReversalSchema.parse(req.body);
    const identity = getAdminIdentity(req);
    const adminUser = await getDbUserByFirebaseUid(identity.firebaseUid);

    await client.query("BEGIN");

    const settlementResult = await client.query<{
      id: string;
      item_id: string;
      amount: number;
      method: string;
      wallet_transaction_id: string | null;
      created_at: string;
      item_title: string;
      room_id: string;
      room_name: string;
      payment_status: string;
      finalized_at: string | null;
      payer_user_id: string | null;
      payer_name: string | null;
      payer_email: string | null;
      receiver_user_id: string;
      receiver_name: string | null;
      receiver_email: string;
      existing_reversal_id: string | null;
    }>(
      `
        SELECT
          settlement.id,
          settlement.item_id,
          settlement.amount::float,
          settlement.method,
          settlement.wallet_transaction_id,
          settlement.created_at,
          item.title AS item_title,
          room.id AS room_id,
          room.name AS room_name,
          room.payment_status,
          room.finalized_at,
          COALESCE(member_user.id, member.user_id) AS payer_user_id,
          COALESCE(member_user.name, member.display_name) AS payer_name,
          COALESCE(member_user.email, member.email) AS payer_email,
          receiver.id AS receiver_user_id,
          receiver.name AS receiver_name,
          receiver.email AS receiver_email,
          reversal.id AS existing_reversal_id
        FROM split_room_item_settlements settlement
        JOIN split_room_items item ON item.id=settlement.item_id
        JOIN split_rooms room ON room.id=item.room_id
        JOIN split_room_members member ON member.id=item.assigned_member_id
        LEFT JOIN users member_user ON member_user.id=member.user_id
          OR (member.user_id IS NULL AND member.email IS NOT NULL AND LOWER(member_user.email)=LOWER(member.email))
        JOIN users receiver ON receiver.id=COALESCE(item.paid_by_user_id,room.paid_by_user_id,room.owner_user_id)
        LEFT JOIN admin_settlement_reversals reversal ON reversal.original_settlement_id=settlement.id
        WHERE settlement.id=$1
        FOR UPDATE OF settlement
      `,
      [settlementId],
    );
    const settlement = settlementResult.rows[0];

    if (!settlement) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Settlement record not found" });
    }

    if (!settlement.payer_user_id || !settlement.payer_email) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "The settlement payer cannot be resolved safely." });
    }

    if (!['wallet', 'manual'].includes(settlement.method)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Only wallet or manually recorded settlements can be reversed. Automatic offsets must be recalculated through the canonical settlement engine." });
    }

    if (settlement.existing_reversal_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "This settlement has already been reversed." });
    }

    if (settlement.finalized_at || settlement.payment_status === "complete") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "This room has already been finalized. SplitVerse will not silently reopen finalized financial history." });
    }

    if (settlement.method === "wallet" && body.refundMode !== "wallet_refund") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Wallet settlements must be refunded through the SplitVerse wallet ledger." });
    }

    if (settlement.method === "manual" && body.refundMode !== "external_refund") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Manually recorded settlements can only be reversed after the money has been returned externally." });
    }

    let payerRefundWalletTransactionId: string | null = null;
    let receiverRefundWalletTransactionId: string | null = null;

    if (body.refundMode === "wallet_refund") {
      const receiverBalanceResult = await client.query<{ wallet_balance: number }>(
        `
          SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END),0)::float AS wallet_balance
          FROM wallet_transactions
          WHERE user_id=$1
        `,
        [settlement.receiver_user_id],
      );
      const receiverBalance = Number(receiverBalanceResult.rows[0]?.wallet_balance ?? 0);

      if (receiverBalance + 0.0001 < Number(settlement.amount)) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          code: "REFUND_BALANCE_INSUFFICIENT",
          message: "The receiver no longer has enough SplitVerse wallet balance to refund this settlement safely.",
          availableBalance: receiverBalance,
          requiredAmount: Number(settlement.amount),
        });
      }

      const refundTransactions = await client.query<{ id: string; user_id: string; type: string }>(
        `
          INSERT INTO wallet_transactions (user_id,type,amount,description)
          VALUES
            ($1,'debit',$3,$4),
            ($2,'credit',$3,$5)
          RETURNING id,user_id,type
        `,
        [
          settlement.receiver_user_id,
          settlement.payer_user_id,
          settlement.amount,
          `Admin refund to ${settlement.payer_name || settlement.payer_email}`,
          `Admin refund from ${settlement.receiver_name || settlement.receiver_email}`,
        ],
      );

      receiverRefundWalletTransactionId = refundTransactions.rows.find(
        (row) => row.user_id === settlement.receiver_user_id && row.type === "debit",
      )?.id ?? null;
      payerRefundWalletTransactionId = refundTransactions.rows.find(
        (row) => row.user_id === settlement.payer_user_id && row.type === "credit",
      )?.id ?? null;
    }

    const reversalSettlement = await client.query<{ id: string }>(
      `
        INSERT INTO split_room_item_settlements (
          item_id, amount, method, created_by_user_id, reversal_of_settlement_id
        ) VALUES ($1,$2,'admin_reversal',$3,$4)
        RETURNING id
      `,
      [settlement.item_id, -Math.abs(Number(settlement.amount)), adminUser?.id ?? null, settlement.id],
    );

    const reversalId = reversalSettlement.rows[0].id;

    await client.query(
      `
        INSERT INTO admin_settlement_reversals (
          original_settlement_id, reversal_settlement_id, refund_mode, amount,
          payer_user_id, payer_email, receiver_user_id, receiver_email,
          admin_user_id, admin_email, reason,
          payer_refund_wallet_transaction_id, receiver_refund_wallet_transaction_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `,
      [
        settlement.id,
        reversalId,
        body.refundMode,
        settlement.amount,
        settlement.payer_user_id,
        settlement.payer_email,
        settlement.receiver_user_id,
        settlement.receiver_email,
        adminUser?.id ?? null,
        identity.email,
        body.reason,
        payerRefundWalletTransactionId,
        receiverRefundWalletTransactionId,
      ],
    );

    await client.query(`UPDATE split_room_items SET collected_at=NULL WHERE id=$1`, [settlement.item_id]);
    await client.query(
      `
        UPDATE split_rooms
        SET payment_status=CASE WHEN payment_status='all_paid' THEN 'no_one_paid' ELSE payment_status END,
            updated_at=NOW()
        WHERE id=$1
      `,
      [settlement.room_id],
    );

    await client.query(
      `
        INSERT INTO admin_audit_logs (
          admin_user_id,admin_email,action,target_type,target_id,reason,before_value,after_value,metadata
        ) VALUES ($1,$2,'SETTLEMENT_REVERSAL_CREATED','settlement',$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)
      `,
      [
        adminUser?.id ?? null,
        identity.email,
        settlement.id,
        body.reason,
        JSON.stringify({
          method: settlement.method,
          amount: settlement.amount,
          roomId: settlement.room_id,
          payerUserId: settlement.payer_user_id,
          receiverUserId: settlement.receiver_user_id,
        }),
        JSON.stringify({ reversalSettlementId: reversalId, refundMode: body.refundMode }),
        JSON.stringify({ itemId: settlement.item_id, roomName: settlement.room_name }),
      ],
    );

    await client.query("COMMIT");

    sendLiveUpdate([settlement.payer_user_id, settlement.receiver_user_id], {
      type: "money",
      reason: "admin-settlement-reversal",
      roomId: settlement.room_id,
    });

    return res.json({
      message: body.refundMode === "wallet_refund" ? "Settlement reversed and wallet funds returned" : "External refund recorded and settlement reversed",
      reversal: {
        originalSettlementId: settlement.id,
        reversalSettlementId: reversalId,
        amount: Number(settlement.amount),
        refundMode: body.refundMode,
        payerUserId: settlement.payer_user_id,
        receiverUserId: settlement.receiver_user_id,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Admin settlement reversal failed:", error);
    return res.status(400).json({ message: "Could not reverse settlement" });
  } finally {
    client.release();
  }
});

router.get("/financial-activity", async (req, res) => {
  try {
    const { page, limit, search } = pageSchema.parse(req.query);
    const offset=(page-1)*limit;
    const term=`%${search.toLowerCase()}%`;
    const result=await db.query(`
      WITH activity AS (
        SELECT i.id::text AS id,'expense_item' AS type,i.amount::float AS amount,'INR' AS currency,i.created_at,r.id::text AS room_id,r.name AS room_name,
          creator.id::text AS user_id,creator.email AS user_email,i.title AS label
        FROM split_room_items i JOIN split_rooms r ON r.id=i.room_id JOIN users creator ON creator.id=i.created_by_user_id
        UNION ALL
        SELECT s.id::text,'settlement_'||s.method,s.amount::float,'INR',s.created_at,r.id::text,r.name,
          u.id::text,u.email,'Settlement recorded'
        FROM split_room_item_settlements s JOIN split_room_items i ON i.id=s.item_id JOIN split_rooms r ON r.id=i.room_id LEFT JOIN users u ON u.id=s.created_by_user_id
        UNION ALL
        SELECT w.id::text,'wallet_'||w.type,w.amount::float,'INR',w.created_at,NULL,NULL,u.id::text,u.email,COALESCE(w.description,'Wallet activity')
        FROM wallet_transactions w JOIN users u ON u.id=w.user_id
      )
      SELECT *,COUNT(*) OVER()::int AS total_count FROM activity
      WHERE ($3='' OR LOWER(COALESCE(label,'')) LIKE $3 OR LOWER(COALESCE(room_name,'')) LIKE $3 OR LOWER(COALESCE(user_email,'')) LIKE $3 OR id=$4)
      ORDER BY created_at DESC LIMIT $1 OFFSET $2
    `,[limit,offset,search?term:"",search]);
    res.json({activity:result.rows.map(({total_count:_t,...row})=>row),page,limit,total:Number(result.rows[0]?.total_count||0)});
  } catch(error){console.error("Admin financial activity failed:",error);res.status(500).json({message:"Failed to load financial activity"});}
});

router.get("/audit", async (req,res)=>{
  try{
    const {page,limit,search}=pageSchema.parse(req.query);const offset=(page-1)*limit;const term=`%${search.toLowerCase()}%`;
    const result=await db.query(`SELECT *,COUNT(*) OVER()::int AS total_count FROM admin_audit_logs WHERE ($3='' OR LOWER(action) LIKE $3 OR LOWER(admin_email) LIKE $3 OR LOWER(target_type) LIKE $3 OR LOWER(COALESCE(target_id,'')) LIKE $3) ORDER BY created_at DESC LIMIT $1 OFFSET $2`,[limit,offset,search?term:""]);
    res.json({events:result.rows.map(({total_count:_t,...row})=>row),page,limit,total:Number(result.rows[0]?.total_count||0),note:"Only events actually recorded by SplitVerse are shown; historical expense edits that predate audit logging cannot be reconstructed."});
  }catch(error){console.error("Admin audit failed:",error);res.status(500).json({message:"Failed to load audit events"});}
});

router.get("/analytics", async (_req,res)=>{
  try{
    const [users,rooms,expenses,settlements]=await Promise.all([
      db.query(`SELECT created_at::date AS day, COUNT(*)::int AS value FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '29 days' GROUP BY created_at::date ORDER BY created_at::date`),
      db.query(`SELECT created_at::date AS day, COUNT(*)::int AS value FROM split_rooms WHERE created_at >= CURRENT_DATE - INTERVAL '29 days' GROUP BY created_at::date ORDER BY created_at::date`),
      db.query(`SELECT created_at::date AS day, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float AS value FROM split_room_items WHERE created_at >= CURRENT_DATE - INTERVAL '29 days' GROUP BY created_at::date ORDER BY created_at::date`),
      db.query(`SELECT method,COUNT(*)::int count,COALESCE(SUM(amount),0)::float amount FROM split_room_item_settlements GROUP BY method ORDER BY method`),
    ]);
    res.json({userGrowth:users.rows,roomGrowth:rooms.rows,expenseActivity:expenses.rows,settlementsByMethod:settlements.rows,currency:"INR"});
  }catch(error){console.error("Admin analytics failed:",error);res.status(500).json({message:"Failed to load analytics"});}
});

router.get("/feature-flags", async (_req,res)=>{
  const result=await db.query(`SELECT key,description,enabled,rollout_percent,updated_at FROM feature_flags ORDER BY key`);
  res.json({flags:result.rows});
});

router.put("/feature-flags/:key", async (req:AuthRequest,res)=>{
  try{
    const key=z.string().trim().regex(/^[a-z0-9_]{2,80}$/).parse(req.params.key);
    const body=z.object({description:z.string().max(240).default(""),enabled:z.boolean(),rolloutPercent:z.number().int().min(0).max(100).default(100),reason:z.string().trim().min(3).max(500)}).parse(req.body);
    const before=await db.query(`SELECT * FROM feature_flags WHERE key=$1`,[key]);
    const identity=getAdminIdentity(req);const dbUser=await getDbUserByFirebaseUid(identity.firebaseUid);
    const result=await db.query(`INSERT INTO feature_flags(key,description,enabled,rollout_percent,updated_by_user_id,updated_at) VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(key) DO UPDATE SET description=EXCLUDED.description,enabled=EXCLUDED.enabled,rollout_percent=EXCLUDED.rollout_percent,updated_by_user_id=EXCLUDED.updated_by_user_id,updated_at=NOW() RETURNING *`,[key,body.description,body.enabled,body.rolloutPercent,dbUser?.id??null]);
    await writeAudit(req,"FEATURE_FLAG_CHANGED","feature_flag",key,body.reason,before.rows[0]??null,result.rows[0]);
    res.json({flag:result.rows[0]});
  }catch(error){console.error("Admin feature flag update failed:",error);res.status(400).json({message:"Could not update feature flag"});}
});

router.get("/config", async (_req,res)=>{
  const result=await db.query(`SELECT key,value,description,updated_at FROM app_configuration ORDER BY key`);
  res.json({config:Object.fromEntries(result.rows.map(row=>[row.key,{value:row.value,description:row.description,updatedAt:row.updated_at}]))});
});

router.put("/config/:key", async (req:AuthRequest,res)=>{
  try{
    const key=z.string().trim().parse(req.params.key);if(!configKeys.has(key)) return res.status(400).json({message:"Unsupported configuration key"});
    const body=z.object({value:z.unknown(),reason:z.string().trim().min(3).max(500)}).parse(req.body);
    if((key==="android_latest_version"||key==="android_minimum_version")&&!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(body.value))) return res.status(400).json({message:"Version must use semantic version format, for example 1.2.0"});
    if(key==="android_update_url"&&body.value&&(()=>{try{new URL(String(body.value));return false}catch{return true}})()) return res.status(400).json({message:"Update URL is invalid"});
    const before=await db.query(`SELECT * FROM app_configuration WHERE key=$1`,[key]);
    const identity=getAdminIdentity(req);const dbUser=await getDbUserByFirebaseUid(identity.firebaseUid);
    const result=await db.query(`INSERT INTO app_configuration(key,value,description,updated_by_user_id,updated_at) VALUES($1,$2::jsonb,'',$3,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by_user_id=EXCLUDED.updated_by_user_id,updated_at=NOW() RETURNING *`,[key,JSON.stringify(body.value),dbUser?.id??null]);
    await writeAudit(req,key.startsWith("android_")?"APP_VERSION_CHANGED":"CONFIGURATION_CHANGED","app_configuration",key,body.reason,before.rows[0]??null,result.rows[0]);
    res.json({configuration:result.rows[0]});
  }catch(error){console.error("Admin config update failed:",error);res.status(400).json({message:"Could not update configuration"});}
});

router.get("/admin-audit-logs", async (req,res)=>{
  const {page,limit,search}=pageSchema.parse(req.query);const offset=(page-1)*limit;const term=`%${search.toLowerCase()}%`;
  const result=await db.query(`SELECT id,admin_email,action,target_type,target_id,reason,before_value,after_value,created_at,COUNT(*) OVER()::int AS total_count FROM admin_audit_logs WHERE ($3='' OR LOWER(action) LIKE $3 OR LOWER(admin_email) LIKE $3 OR LOWER(target_type) LIKE $3) ORDER BY created_at DESC LIMIT $1 OFFSET $2`,[limit,offset,search?term:""]);
  res.json({logs:result.rows.map(({total_count:_t,...row})=>row),page,limit,total:Number(result.rows[0]?.total_count||0)});
});

router.get("/security", async (_req,res)=>{
  try {
    const [accounts, riskEvents, adminEvents, counts] = await Promise.all([
      db.query(`
        SELECT
          u.id,u.name,u.username,u.email,
          state.status,state.reason,state.updated_at,
          admin.email AS updated_by_email,
          (SELECT COUNT(*)::int FROM user_installation_links link WHERE link.user_id=u.id) AS installation_count,
          (SELECT COUNT(*)::int FROM user_installation_links link JOIN client_installations installation ON installation.installation_hash=link.installation_hash WHERE link.user_id=u.id AND installation.restricted_at IS NOT NULL) AS restricted_installation_count
        FROM user_security_states state
        JOIN users u ON u.id=state.user_id
        LEFT JOIN users admin ON admin.id=state.updated_by_admin_user_id
        WHERE state.status IN ('restricted','blocked')
        ORDER BY CASE state.status WHEN 'blocked' THEN 0 ELSE 1 END,state.updated_at DESC
        LIMIT 100
      `),
      db.query(`
        SELECT event.id,event.event_type,event.user_id,event.related_user_id,event.metadata,event.created_at,
          u.email AS user_email,related.email AS related_user_email
        FROM security_events event
        LEFT JOIN users u ON u.id=event.user_id
        LEFT JOIN users related ON related.id=event.related_user_id
        ORDER BY event.created_at DESC
        LIMIT 100
      `),
      db.query(`
        SELECT admin_email,action,target_type,target_id,reason,created_at
        FROM admin_audit_logs
        WHERE action IN ('USER_BLOCKED','USER_RESTRICTED','USER_RESTORED','SETTLEMENT_REVERSAL_CREATED','FORCE_UPDATE_CHANGED','MAINTENANCE_MODE_CHANGED')
        ORDER BY created_at DESC LIMIT 50
      `),
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM user_security_states WHERE status='blocked')::int AS blocked,
          (SELECT COUNT(*) FROM user_security_states WHERE status='restricted')::int AS restricted,
          (SELECT COUNT(*) FROM client_installations WHERE restricted_at IS NOT NULL)::int AS restricted_installations,
          (SELECT COUNT(*) FROM security_events WHERE event_type='POTENTIAL_BAN_EVASION' AND created_at >= NOW()-INTERVAL '30 days')::int AS evasion_signals_30d
      `),
    ]);

    res.json({
      counts: counts.rows[0],
      accounts: accounts.rows,
      riskEvents: riskEvents.rows,
      events: adminEvents.rows,
      note: "Account restrictions are enforced server-side. Installation matches are used as a risk signal only; a new account on a restricted installation is placed into review instead of being automatically permanently blocked.",
    });
  } catch (error) {
    console.error("Admin security failed:", error);
    res.status(500).json({message:"Failed to load security view"});
  }
});

export default router;
