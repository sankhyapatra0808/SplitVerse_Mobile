# SplitVerse: evidence-first performance toolkit

This is a targeted addition to the existing app, **not** a redesign or financial-logic rewrite. The sole visual change is in `mobile/src/components/Screen.tsx` (the transient swipe hint was removed; swiping and screen transitions remain). Only the security-event index has been proposed as a migration. No existing indexes were dropped.

## First: audit before changing production

The repo already has a connection pool, GET request deduplication in the mobile API client, exchange-rate caching, public-config HTTP caching, and extensive indexes (`src/db/performanceIndexes.ts` and prior migrations). Don't install Redis or add speculative indexes just because a plan mentions them. **Never use real personal data or include a database URL/token in reports.**

From `backend/server` on a safe testing database (with a read-only account):

```bash
npm ci
npm run build
# Without sample IDs: catalog stats and optional pg_stat_statements only.
DATABASE_URL='postgresql://<read-only-user>@<staging-host>/<staging-db>' npm run db:audit > baseline.json
# Optional: real, disposable staging test user to analyze fixed read-only SELECTs.
DATABASE_URL='postgresql://<read-only-user>@<staging-host>/<staging-db>' \
PERFORMANCE_USER_ID='<test-user-uuid>' PERFORMANCE_EMAIL='test@example.invalid' \
npm run db:audit > baseline-with-plans.json
```

All sample `EXPLAIN (ANALYZE, BUFFERS)` statements in this tool are SELECT-only and wrapped in a `READ ONLY` transaction. The audit outputs *plans/metrics*, never row data or query parameters. The pg_stat_statements summary intentionally omits query text. Live query statistics and execution plans are unavailable from the ZIP alone, and this tool cannot establish a before/after result until you run it on staging. `pg_stat_statements` requires the extension to be installed by your database administrator/provider; **do not automatically enable it in migrations**.

Inspect index usage with `index-inspection.sql`. Some indexes are possible duplicates/prefix overlaps: `expenses_user_created_idx` vs `expenses_user_created_at_idx`; `expenses_user_date_idx` vs `expenses_user_expense_date_idx`; `friend_requests_recipient_status_idx` vs `friend_requests_recipient_status_created_idx`; and `friendships_user_one_created_idx` vs `friendships_user_one_idx`. **Do not drop anything** without verifying index definitions, uniqueness/constraints, access patterns, and usage over a representative period. Index scans reset when Postgres statistics reset.

### Index migration 030

`src/db/migrations/030_security_events_related_user_index.sql` supports the existing per-user admin security-event query, which filters `user_id = $1 OR related_user_id = $1`. The current `(user_id, created_at DESC)` index only supports one side; the added partial index targets the second side. This is *a candidate justified by the query shape*, **not a measured performance improvement**. Verify query volume, table size, and EXPLAIN first; a small table may be faster with a sequential scan. It requires no data changes and is safe to roll back at the index level.

For small or inactive tables, run the existing migration command **on staging first**, with a database backup:

```bash
npm run db:migrate
```

**Live/large-table alternative:** The standard migration runner wraps each `.sql` file in a transaction and **cannot** run `CREATE INDEX CONCURRENTLY`. If that index is needed on a large live table, create it separately with a maintenance operator session (outside a transaction), then run migrations; the `IF NOT EXISTS` statement will skip the already-created index:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS security_events_related_user_created_idx
  ON security_events (related_user_id, created_at DESC)
  WHERE related_user_id IS NOT NULL;
```

If concurrent creation fails, inspect `pg_index.indisvalid` for that index before retrying: an invalid leftover index can require `DROP INDEX CONCURRENTLY` and a fresh create. Never run concurrent index commands inside `BEGIN`. Be aware the regular migration runner will still execute all **other unapplied** migrations; review them first.

Rollback for migration 030's index only (after checking it is unused and no longer needed):

```sql
DROP INDEX CONCURRENTLY IF EXISTS security_events_related_user_created_idx;
```

This rollback is outside a transaction and does *not* automatically remove the migration log row; coordinate with the migration operator. Do not delete production data or change historical financial records.

## k6 safe staging load test

Requires the external `k6` binary, and **one or more disposable staging Firebase ID tokens** from test users that already exist in the staging database. No real payment requests, financial writes, SMS or email endpoints are tested. Tokens are short lived (refresh them before running). No secrets are built into scripts.

```bash
# Local backend with test database
SPLITVERSE_STAGING_URL=http://localhost:5000 \
SPLITVERSE_TEST_TOKENS='<staging-firebase-id-token>' \
SPLITVERSE_MAX_VUS=10 \
k6 run performance/k6/readonly-workflows.js --summary-export=k6-baseline.json

# Dedicated staging deployment (never a live production deployment)
SPLITVERSE_STAGING_URL=https://<staging-api-host> \
SPLITVERSE_STAGING_CONFIRMED=YES \
SPLITVERSE_TEST_TOKENS='<staging-firebase-id-token>' \
SPLITVERSE_MAX_VUS=30 \
k6 run performance/k6/readonly-workflows.js --summary-export=k6-staging.json
```

The script denies the known SplitVerse production hosts and requires explicit confirmation for remote targets, but hosts can be renamed: **you are responsible for verifying the target is staging**. It uses GET-only flows (session, dashboard, rooms, net settlement, wallet, transactions, friends), has think time, ramps gradually, and checks `<500ms p95`, `<1% failure`, and `<1% workflow failures`. Requests use test authentication; sharing tokens between virtual users affects rate limits and must be factored into results. Compare CPU, RAM, DB active connections, query times, 429s, and 5xx alongside k6 outputs.

A write scenario was deliberately **not** automated: write load can alter expense and wallet data and requires an isolated, resettable test database and defined assertions before enabling it.

## Current known behavior and cache policy

| Data | Existing behavior / safe policy |
| --- | --- |
| Public app config | `Cache-Control` public max-age 60s; still consider admin change propagation |
| Exchange rates | Persistent PostgreSQL cache with configurable TTL and stale fallback |
| Mobile GETs | Concurrent same-user/same-path requests are coalesced (no persistent staleness) |
| Frontend | Small scoped caches with event-based invalidation, see `frontend/src/lib/api.ts` |
| Rooms/friends/dashboard | Prefer request deduplication and measured query improvement; user-scoped cache only with invalidation after *every* relevant mutation |
| Wallet balance, payment confirmation, settlements | Authoritative reads; no shared stale result caching |

Do not introduce Redis unless profiling shows existing mechanisms cannot meet latency/cost goals. If adopting shared caching later, use per-user keys, strict TTLs, complete invalidation, and graceful fallback; evaluate costs first.

## Hosting and 10x readiness: measurements still required

The ZIP cannot reveal your actual hosted plan, compute limits, pooler mode, database statistics, peak traffic, network usage or cost. Before claiming 10x readiness, record these from your hosting dashboards and the above tests. The opt-in `/api/health` diagnostics now include pool open/idle/waiting counts (disabled by default in production). Existing `DB_POOL_MAX` defaults to 10 **per backend instance**, not globally. For N instances a rough upper demand is `N * DB_POOL_MAX` connections, before background jobs and other consumers. Check Neon pooled vs direct database URL and transaction pooling restrictions; changing pool settings blindly can cause exhaustion. Rate limits currently use a local in-process limiter; scaling to multiple replicas may require a shared limiter, but do not change enforcement without validating Redis/storage and attack controls. Real-time SSE connections and process-local caches also need multiple-instance checks.

Suggested performance comparison after deployment:

| Metric | Baseline | After | Measurement method |
| --- | --- | --- | --- |
| p95 latency, error rate, RPS | TBD | TBD | k6 summary |
| Slow queries / execution plans | TBD | TBD | `db:audit` / selected full SELECT plans |
| DB active connections | TBD | TBD | pg_stat_activity/provider |
| CPU, memory and heap growth | TBD | TBD | provider APM/OS metrics |
| Index scans, index disk size | TBD | TBD | pg_stat_user_indexes / pg_relation_size |
| Write overhead and DB storage | TBD | TBD | DB monitoring and write tests |
| Monthly cost at current vs 10x | TBD | TBD | verified provider plan/pricing |

Never fill missing numbers with estimates presented as measured facts. Prioritize by measured impact.

## Regression checks before deployment

- Swipe left/right between Home, Rooms, Wallet, Profile; no hint box, vertical scroll and horizontal actions work; bottom tabs unchanged.
- Login/logout, onboarding, auth token renewal, account switching; no data leakage.
- Room creation, editing, member assignment, settlement offset and reminder flows; before/after results match.
- Wallet top-up test mode, PIN checks, ledger balance, transactions, idempotency, and reversal behavior; never test against real funds.
- Friends, invites, user blocks, notification streams and admin access permissions.
- Database migrations on a staging snapshot, rollback procedure, query plans, actual write overhead.
- Rate-limit behavior, SSE reliability and CORS under representative staging traffic.

**No production database has been accessed, migrated, or load-tested by this deliverable.**
