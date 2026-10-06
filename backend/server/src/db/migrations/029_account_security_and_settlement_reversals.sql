CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS user_security_states (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'blocked')),
  reason TEXT,
  updated_by_admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_security_states_status_updated_idx
  ON user_security_states (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS client_installations (
  installation_hash TEXT PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'unknown',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restricted_at TIMESTAMPTZ,
  restricted_reason TEXT
);

CREATE INDEX IF NOT EXISTS client_installations_restricted_idx
  ON client_installations (restricted_at DESC)
  WHERE restricted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_installation_links (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_hash TEXT NOT NULL REFERENCES client_installations(installation_hash) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, installation_hash)
);

CREATE INDEX IF NOT EXISTS user_installation_links_hash_idx
  ON user_installation_links (installation_hash, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  installation_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_events_created_idx
  ON security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_user_created_idx
  ON security_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_type_created_idx
  ON security_events (event_type, created_at DESC);

ALTER TABLE split_room_item_settlements
  ADD COLUMN IF NOT EXISTS reversal_of_settlement_id UUID REFERENCES split_room_item_settlements(id) ON DELETE SET NULL;

ALTER TABLE split_room_item_settlements
  DROP CONSTRAINT IF EXISTS split_room_item_settlements_amount_check;
ALTER TABLE split_room_item_settlements
  DROP CONSTRAINT IF EXISTS split_room_item_settlements_method_check;

ALTER TABLE split_room_item_settlements
  ADD CONSTRAINT split_room_item_settlements_method_check
  CHECK (method IN ('wallet', 'manual', 'offset', 'admin_reversal'));

ALTER TABLE split_room_item_settlements
  ADD CONSTRAINT split_room_item_settlements_amount_check
  CHECK (
    (method IN ('wallet', 'manual', 'offset') AND amount > 0)
    OR
    (method = 'admin_reversal' AND amount < 0 AND reversal_of_settlement_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS split_room_item_settlements_reversal_unique_idx
  ON split_room_item_settlements (reversal_of_settlement_id)
  WHERE method = 'admin_reversal' AND reversal_of_settlement_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_settlement_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_settlement_id UUID NOT NULL UNIQUE,
  reversal_settlement_id UUID NOT NULL UNIQUE,
  refund_mode TEXT NOT NULL CHECK (refund_mode IN ('wallet_refund', 'external_refund')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payer_email TEXT,
  receiver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  receiver_email TEXT,
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  reason TEXT NOT NULL,
  payer_refund_wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  receiver_refund_wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_settlement_reversals_created_idx
  ON admin_settlement_reversals (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_settlement_reversals_payer_idx
  ON admin_settlement_reversals (payer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_settlement_reversals_receiver_idx
  ON admin_settlement_reversals (receiver_user_id, created_at DESC);
