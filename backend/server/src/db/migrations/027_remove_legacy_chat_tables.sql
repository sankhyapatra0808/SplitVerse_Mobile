-- 027_remove_legacy_chat_tables.sql
-- Removes the abandoned SplitVerse chat/E2EE tables only.
-- Keeps username, friend identity, and other non-chat schema intact.

BEGIN;

DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_key_envelopes;
DROP TABLE IF EXISTS chat_conversation_members;
DROP TABLE IF EXISTS chat_conversations;
DROP TABLE IF EXISTS chat_devices;

COMMIT;
