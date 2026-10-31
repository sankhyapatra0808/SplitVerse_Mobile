# SplitVerse source-code query audit (2026-10-30)

**Scope:** Code review of `backend/server/src/routes` and committed SQL migrations in the supplied ZIP. This is **not** a report from a running database; query frequencies, elapsed times, table sizes, actual scan types, and index-hit ratios remain unmeasured. Inspecting source does not establish real-world bottlenecks. See `README.md` for the read-only measurement tool.

## Screen and workflow map

| Workflow | Main backend source | Representative access pattern | Existing index evidence / remaining risk |
| --- | --- | --- | --- |
| Dashboard | `dashboard.routes.ts` | Lookup user by `firebase_uid`; pending split-room settlement joins and aggregates; expenses for today/year; wallet transaction sum; month/peak-day groupings | `users_firebase_uid_idx`, `expenses_user_date_idx`, and `wallet_transactions_user_created_idx` support user filters. The settlement aggregate groups all `split_room_item_settlements`; may cost more as records grow, but cannot be optimized safely without measuring / preserving exact netting logic. |
| Rooms | `splitRooms.routes.ts` | Owned and joined rooms; room members and items; settlement sums; visibility checks | Owner and member indexes exist in `performanceIndexes.ts`; room-item and settlement item indexes exist in migrations. Validate joins and sort order with actual plans before changing them. |
| Wallet | `wallet.routes.ts` | User-scoped wallet history; wallet balance sum; settlement net amount | `wallet_transactions_user_created_idx`, `wallet_transactions_user_type_created_idx` exist. Balance/settlement summaries must remain authoritative. |
| Transaction history | `transactions.routes.ts` | Union of expenses, wallet transactions, settlements; filters then sorts/paginates | Per-user transaction/expense indexes exist; the union and window-based date filters may still be heavy. Do not rewrite transaction filters without snapshot-equivalence tests. |
| Friends | `friends.routes.ts` | `friendships` on both user columns; pending inbound/outbound requests; user blocks | `friendships_user_one_created_idx`, `friendships_user_two_created_idx`, request/status and block indexes exist. Some runtime index definitions overlap migration indexes; review before removal. |
| Notifications | `liveEvents.ts` / `splitRooms.routes.ts` | Server-sent events and room reminders | SSE is connection-oriented and needs a multi-instance review. Do not add event-bus infrastructure without a scale test. |
| Settings/auth | `auth.routes.ts`, `security/accountSecurity.ts` | `users.firebase_uid`, profile records, OTP/security events and installations | User and security indexes exist; look at auth service limits and indexed OTP expiry only with real workload. |
| Admin | `admin.routes.ts` | Counts across several tables; user-detail joins; security events `WHERE user_id=$1 OR related_user_id=$1 ORDER BY created_at DESC` | Security event `(user_id, created_at)` already exists, but related-user branch lacked an equivalent candidate index; migration 030 adds a partial index. The wide overview counting/sorting query can still be expensive at scale. |

## Changes specifically authorized by the code evidence

1. Remove `Screen.tsx`'s animated swipe-preview badge and state updates. Keep the existing navigation PanResponder, threshold, animation, and tab destinations.
2. Add an index for `security_events.related_user_id` because the real admin-user-detail query filters on that column. Verify it improves the plan on representative data; this is **not** a blanket authorization to add every proposed index.
3. Add connection-pool counters to **opt-in diagnostics** only. No new DB work, API route, or login step is required.
4. Add an optional read-only database stats/EXPLAIN script and a read-only staging k6 workload. No production data, chargeable provider action, or financial transaction is changed.

## Potential opportunities deliberately not changed

- The repeated settlement/debt-line aggregation in dashboard and wallet code is a measurable-cost candidate, but changes risk wallet and cross-room netting semantics. Needs EXPLAIN and deterministic financial regression fixtures first.
- Transaction history builds several sources into a combined result and applies filters. Optimize only after verifying pagination counts/ordering and all month/timezone cases.
- `performanceIndexes.ts` and migration `014` contain overlapping indexes (examples in README). Do **not** automatically drop them: check constraints, actual definitions, usage and query plans, and then prepare a separately approved rollback-aware migration.
- Client caches already exist. No Redis install, long-lived wallet caching or automatic room-dashboard cache was added without an invalidation proof.
- Rate limiting and SSE may require cross-instance state; evidence of multiple backend instances and expected traffic is needed before changing behavior.

## Missing measurements / deploy gates

- Actual `pg_stat_statements` statistics and `EXPLAIN (ANALYZE, BUFFERS)` full-query plans, before and after.
- Database row counts, existing indexes **on the deployed schema** (may differ from migrations), session/connection pool metrics and index storage.
- k6 p50/p95, RPS, error rate, peak VUs and first failing endpoint from an isolated staging environment.
- Backend CPU, memory, event-loop lag, HTTP payload sizes, SSE connection behavior.
- Provider plans/limits/pricing and actual daily/monthly/peak user volume.

Do not claim a measured speedup, production stability, or 10× readiness until those observations have been recorded.
