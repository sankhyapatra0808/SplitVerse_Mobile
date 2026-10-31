# Targeted optimization delivery

This package is based on the supplied `splitverse_tester(10).zip`. The underlying app was not redesigned; payment and settlement code was not modified.

## Code changes

1. `mobile/src/components/Screen.tsx` — removed the swipe destination badge and its state/animations while leaving the existing navigation and gesture thresholds intact.
2. `backend/server/src/index.ts` — added database pool counters to existing opt-in health diagnostics (production default response unchanged).
3. `backend/server/src/db/migrations/030_security_events_related_user_index.sql` — candidate partial index for the admin security-event query; run only after review on staging.
4. `backend/server/src/performance/auditDatabase.ts` and server `package.json` — read-only index/usage audit with optional `EXPLAIN ANALYZE` of fixed SELECT-only samples.
5. `backend/server/performance/` — k6 read-only staging workload, query mapping, index usage SQL, caching policy, rollback and test instructions.

## Verification and limitations

- Changed TypeScript files were parsed/transpiled successfully with the available system TypeScript compiler.
- JavaScript load-test file passed `node --check`.
- The complete build and runtime tests could not be completed in the supplied offline environment because project dependencies were not present / npm installation did not finish.
- No connected PostgreSQL server or staging backend was provided, so there are **no measured before/after performance claims**, executed migrations, or k6 results.
- See `backend/server/performance/README.md` for deployment gates and important safety restrictions.

## Applying

From the changed-files ZIP, copy the files into the same relative paths in your original project. Or use the complete project source ZIP. Review `030` before running database migrations; do not direct the k6 script at production. Run `npm install` for each package using your normal environment, then `npm run typecheck:mobile`, `npm run build`, and `npm run test:backend` from the repo root.
