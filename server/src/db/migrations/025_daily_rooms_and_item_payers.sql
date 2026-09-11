ALTER TABLE split_rooms
  ADD COLUMN IF NOT EXISTS daily_room_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS split_rooms_owner_daily_room_idx
  ON split_rooms (owner_user_id, daily_room_date)
  WHERE daily_room_date IS NOT NULL;

ALTER TABLE split_room_items
  ADD COLUMN IF NOT EXISTS paid_by_member_id UUID REFERENCES split_room_members(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS paid_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS split_group_id UUID;

UPDATE split_room_items AS item
SET paid_by_user_id = COALESCE(room.paid_by_user_id, room.owner_user_id)
FROM split_rooms AS room
WHERE room.id = item.room_id
AND item.paid_by_user_id IS NULL;

CREATE INDEX IF NOT EXISTS split_room_items_paid_by_user_idx
  ON split_room_items (paid_by_user_id, collected_at, created_at DESC);

CREATE INDEX IF NOT EXISTS split_room_items_split_group_idx
  ON split_room_items (split_group_id)
  WHERE split_group_id IS NOT NULL;
