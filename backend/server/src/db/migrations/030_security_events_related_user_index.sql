-- Supports the admin user-detail query in admin.routes.ts:
-- WHERE user_id = $1 OR related_user_id = $1 ORDER BY created_at DESC
-- Existing security_events_user_created_idx covers the first OR branch;
-- there is no equivalent index for the second branch.
-- Apply during a quiet staging/maintenance window. Review EXPLAIN first.
-- For a large live table, create this index CONCURRENTLY via the documented
-- manual procedure rather than running this transactional migration under load.
CREATE INDEX IF NOT EXISTS security_events_related_user_created_idx
  ON security_events (related_user_id, created_at DESC)
  WHERE related_user_id IS NOT NULL;
