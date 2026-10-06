CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT;

DO $$
DECLARE
  user_row RECORD;
  base_username TEXT;
  candidate TEXT;
  suffix_index INTEGER;
BEGIN
  FOR user_row IN
    SELECT id, email
    FROM users
    WHERE username IS NULL OR BTRIM(username) = ''
    ORDER BY created_at, id
  LOOP
    base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(user_row.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));

    IF LENGTH(base_username) < 3 THEN
      base_username := 'user_' || SUBSTRING(REPLACE(user_row.id::text, '-', '') FROM 1 FOR 8);
    END IF;

    base_username := LEFT(base_username, 24);
    candidate := base_username;
    suffix_index := 0;

    WHILE EXISTS (
      SELECT 1
      FROM users
      WHERE LOWER(username) = LOWER(candidate)
      AND id <> user_row.id
    ) LOOP
      suffix_index := suffix_index + 1;
      candidate := LEFT(base_username, GREATEST(3, 29 - LENGTH(suffix_index::text))) || '_' || suffix_index::text;
    END LOOP;

    UPDATE users
    SET username = candidate
    WHERE id = user_row.id;
  END LOOP;
END $$;

ALTER TABLE users
  ALTER COLUMN username SET NOT NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_username_format_check;

ALTER TABLE users
  ADD CONSTRAINT users_username_format_check
  CHECK (username ~ '^[a-z0-9_]{3,30}$');

CREATE UNIQUE INDEX IF NOT EXISTS users_lower_username_unique_idx
  ON users (LOWER(username));

CREATE INDEX IF NOT EXISTS users_search_username_name_email_idx
  ON users (LOWER(username), LOWER(COALESCE(name, '')), LOWER(email));

ALTER TABLE friend_requests
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

UPDATE friend_requests request
SET recipient_user_id = recipient.id
FROM users recipient
WHERE request.recipient_user_id IS NULL
AND LOWER(request.recipient_email) = LOWER(recipient.email);

CREATE INDEX IF NOT EXISTS friend_requests_recipient_user_status_idx
  ON friend_requests (recipient_user_id, status, created_at DESC);
