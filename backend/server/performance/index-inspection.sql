-- Read-only observations. Use a DB role with SELECT/catalog privileges.
-- pg_stat_statements extension is optional; run the Node audit CLI for graceful detection.

-- Identify high-write tables and index/seq-scan ratios. A sequential scan is not always inefficient.
SELECT relname AS table_name, n_live_tup AS estimated_rows,
       seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del,
       last_analyze, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Index usage since statistics were last reset. Never drop indexes solely based on 0 scans.
SELECT relname AS table_name, indexrelname AS index_name,
       idx_scan, idx_tup_read, idx_tup_fetch,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY relname, indexrelname;

-- Full index definitions, including unique/constraint-backed indexes.
SELECT tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- High-level database connection pressure.
SELECT datname, state, COUNT(*) AS connections
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY datname, state;
