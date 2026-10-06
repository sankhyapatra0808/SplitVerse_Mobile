-- Repair migration for databases where the renamed 021 migration
-- re-applied users.username NOT NULL after migration 023 had already run.
--
-- SplitVerse intentionally allows username to be NULL temporarily while a
-- newly authenticated Firebase account completes username + wallet-PIN setup.

ALTER TABLE users
  ALTER COLUMN username DROP NOT NULL;

-- Ensure the permanent-username trigger still permits the one-time transition
-- from NULL -> chosen username, while preventing later username changes.
CREATE OR REPLACE FUNCTION prevent_splitverse_username_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.username IS NOT NULL AND OLD.username IS DISTINCT FROM NEW.username THEN
    RAISE EXCEPTION 'SplitVerse usernames are permanent and cannot be changed'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
