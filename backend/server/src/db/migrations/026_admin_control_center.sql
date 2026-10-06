CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT,
  before_value JSONB,
  after_value JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx
  ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_created_idx
  ON admin_audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx
  ON admin_audit_logs (target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_configuration (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO app_configuration (key, value, description)
VALUES
  ('android_latest_version', '"1.1.0"'::jsonb, 'Latest Android release version'),
  ('android_minimum_version', '"1.0.0"'::jsonb, 'Minimum supported Android version'),
  ('android_force_update', 'false'::jsonb, 'Force users below the minimum version to update'),
  ('android_update_url', '""'::jsonb, 'Direct Android APK/update URL'),
  ('android_release_notes', '""'::jsonb, 'Current Android release notes'),
  ('maintenance_enabled', 'false'::jsonb, 'Global maintenance mode'),
  ('maintenance_message', '"SplitVerse is temporarily unavailable for maintenance."'::jsonb, 'Message displayed during maintenance')
ON CONFLICT (key) DO NOTHING;
