export type SplitRoomFriendSelectionMode = "assign" | "automatic";

export type SplitRoomFriendSelectionResult = {
  roomId: string;
  mode: SplitRoomFriendSelectionMode;
  selectedEmails: string[];
};

let pendingSelection: SplitRoomFriendSelectionResult | null = null;

export function setPendingSplitRoomFriendSelection(
  selection: SplitRoomFriendSelectionResult,
) {
  pendingSelection = selection;
}

export function consumePendingSplitRoomFriendSelection() {
  const selection = pendingSelection;
  pendingSelection = null;
  return selection;
}
