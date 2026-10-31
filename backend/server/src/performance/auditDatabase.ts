/**
 * Read-only PostgreSQL performance audit.
 * Never runs EXPLAIN ANALYZE on statements that modify data.
 * Usage: PERFORMANCE_USER_ID=<uuid> PERFORMANCE_EMAIL=<email> npm run db:audit
 * PERFORMANCE_FIREBASE_UID optionally enables user lookup plan.
 */
import "dotenv/config";
import { db } from "../config/db.js";

const examples = [
  {
    name: "Dashboard: today's expenses",
    sql: `SELECT amount FROM expenses WHERE user_id = $1 AND expense_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date`,
    params: (id: string, _email: string) => [id],
  },
  {
    name: "Rooms: owner's newest rooms",
    sql: `SELECT id, created_at FROM split_rooms WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 40`,
    params: (id: string, _email: string) => [id],
  },
  {
    name: "Rooms: member's room memberships",
    sql: `SELECT room_id FROM split_room_members WHERE user_id = $1`,
    params: (id: string, _email: string) => [id],
  },
  {
    name: "Wallet: recent transactions",
    sql: `SELECT id, created_at FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40`,
    params: (id: string, _email: string) => [id],
  },
  {
    name: "Friends: inbound pending requests",
    sql: `SELECT id, created_at FROM friend_requests WHERE LOWER(recipient_email) = LOWER($1) AND status = 'pending' ORDER BY created_at DESC LIMIT 40`,
    params: (_id: string, email: string) => [email],
  },
  {
    name: "Admin: user's security events",
    sql: `SELECT event_type, created_at FROM security_events WHERE user_id = $1 OR related_user_id = $1 ORDER BY created_at DESC LIMIT 40`,
    params: (id: string, _email: string) => [id],
  },
] as const;

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  "Actual Rows"?: number;
  "Actual Loops"?: number;
  Plans?: PlanNode[];
};

function summarizePlan(node: PlanNode, acc: Record<string, unknown>[] = []) {
  acc.push({
    operation: node["Node Type"],
    relation: node["Relation Name"],
    index: node["Index Name"],
    rows: node["Actual Rows"],
    loops: node["Actual Loops"],
  });
  for (const child of node.Plans ?? []) summarizePlan(child, acc);
  return acc;
}

async function explainReads(id: string, email: string) {
  const output: unknown[] = [];
  // Transaction READ ONLY is a second line of defense in addition to the fixed SELECT-only statements.
  const client = await db.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '12000ms'");
    for (const example of examples) {
      try {
        const result = await client.query(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${example.sql}`,
          example.params(id, email),
        );
        const plan = result.rows[0]?.["QUERY PLAN"]?.[0];
        output.push({
          query: example.name,
          executionMs: plan?.["Execution Time"],
          planningMs: plan?.["Planning Time"],
          nodes: plan?.Plan ? summarizePlan(plan.Plan as PlanNode) : [],
        });
      } catch (error) {
        // Failed SELECT leaves transaction aborted; a savepoint lets remaining probes run.
        output.push({ query: example.name, error: String(error) });
        // This example failure is fatal for this transaction; stop rather than invoke any writes.
        break;
      }
    }
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
  return output;
}

async function audit() {
  const [indexes, tables, duplicates] = await Promise.all([
    db.query(`SELECT s.relname AS table_name, i.relname AS index_name,
        pg_get_indexdef(ix.indexrelid) AS definition,
        COALESCE(st.idx_scan, 0)::bigint AS scans,
        pg_relation_size(ix.indexrelid)::bigint AS size_bytes
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class s ON s.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = s.relnamespace
      LEFT JOIN pg_stat_user_indexes st ON st.indexrelid = ix.indexrelid
      WHERE n.nspname = 'public'
      ORDER BY s.relname, i.relname`),
    db.query(`SELECT relname AS table_name, n_live_tup::bigint AS estimated_rows,
        seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del,
        last_analyze, last_autoanalyze
      FROM pg_stat_user_tables ORDER BY n_live_tup DESC`),
    db.query(`SELECT n.nspname AS schema, c.relname AS table_name,
         pg_get_indexdef(i.indexrelid, 0, true) AS definition,
         COUNT(*) OVER (PARTITION BY i.indrelid, i.indkey::text, i.indexprs::text, i.indpred::text) AS potential_duplicate_count
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'`),
  ]);

  const output: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    notes: [
      "Estimated row counts and scan counters are PostgreSQL statistics, not exact counts.",
      "Zero index scans can reflect a recent statistics reset or a small table; they do NOT justify dropping an index alone.",
      "Similar or prefix-overlapping indexes require a manual semantic review before removal.",
      "Representative EXPLAIN examples are not a substitute for the production full queries and real workload.",
    ],
    tables: tables.rows,
    indexes: indexes.rows,
    possibleExactDuplicates: duplicates.rows.filter((item) => Number(item.potential_duplicate_count) > 1),
  };

  try {
    const extension = await db.query(`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS available`);
    if (extension.rows[0]?.available) {
      // Do not emit SQL text or parameters from other users' queries; aggregate metadata only.
      const top = await db.query(`SELECT queryid::text AS query_id, calls,
          ROUND(total_exec_time::numeric, 2) AS total_ms,
          ROUND(mean_exec_time::numeric, 2) AS average_ms,
          rows
        FROM pg_stat_statements
        ORDER BY total_exec_time DESC LIMIT 20`);
      output.mostExpensiveQueries = top.rows;
    } else {
      output.mostExpensiveQueries = "pg_stat_statements extension not enabled";
    }
  } catch (error) {
    output.mostExpensiveQueries = `pg_stat_statements not accessible: ${String(error)}`;
  }

  const userId = process.env.PERFORMANCE_USER_ID?.trim() || "";
  const email = process.env.PERFORMANCE_EMAIL?.trim() || "";
  if (/^[0-9a-f-]{36}$/i.test(userId) && email.includes("@")) {
    output.readOnlyExplainSamples = await explainReads(userId, email);
  } else {
    output.readOnlyExplainSamples = "Skipped: supply test-only PERFORMANCE_USER_ID (UUID) and PERFORMANCE_EMAIL";
  }

  console.log(JSON.stringify(output, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2));
}

audit()
  .catch((error) => {
    console.error("Read-only audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => db.end());
