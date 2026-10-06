-- Performance indexes that are unique to this migration.
-- Base tables and their foundational indexes are created by earlier migrations.
CREATE INDEX IF NOT EXISTS users_firebase_uid_idx ON users (firebase_uid);

CREATE INDEX IF NOT EXISTS friend_requests_recipient_status_idx
  ON friend_requests (LOWER(recipient_email), status, created_at DESC);

CREATE INDEX IF NOT EXISTS friend_requests_requester_status_idx
  ON friend_requests (requester_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS friendships_user_one_created_idx
  ON friendships (user_one_id, created_at DESC);

CREATE INDEX IF NOT EXISTS friendships_user_two_created_idx
  ON friendships (user_two_id, created_at DESC);

CREATE INDEX IF NOT EXISTS split_room_items_assigned_pending_idx
  ON split_room_items (assigned_member_id, created_at DESC)
  WHERE collected_at IS NULL;

CREATE INDEX IF NOT EXISTS expenses_user_created_idx
  ON expenses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS expenses_user_date_idx
  ON expenses (user_id, expense_date DESC);
