import * as SecureStore from "expo-secure-store";
import type { FriendRequest, SplitRoom, WalletSummaryResponse } from "./api";

const SEEN_NOTIFICATIONS_KEY = "splitverse-seen-notification-signature";

export type NotificationKind = "friend" | "wallet" | "room";

export type LiveNotificationItem = {
  id: string;
  title: string;
  detail: string;
  amount?: number;
  kind: NotificationKind;
  route: "/(tabs)/profile" | "/(tabs)/wallet" | "/(tabs)/split-rooms";
};

export function buildFriendNotifications(
  requests: FriendRequest[] = [],
): LiveNotificationItem[] {
  return requests
    .filter((request) => request.status === "pending")
    .map((request) => ({
      id: `friend-${request.id}`,
      title: "Friend request",
      detail: `${request.requester_name || "Someone"} wants to connect.`,
      kind: "friend" as const,
      route: "/(tabs)/profile" as const,
    }));
}

export function buildRoomNotifications(
  rooms: SplitRoom[] = [],
): LiveNotificationItem[] {
  return rooms
    .filter((room) => Number(room.outstandingAmount || 0) > 0)
    .slice(0, 6)
    .map((room) => ({
      id: `room-${room.id}-${Number(room.outstandingAmount || 0).toFixed(2)}`,
      title: "Room due reminder",
      detail: `${room.name} still has pending dues.`,
      amount: Number(room.outstandingAmount || 0),
      kind: "room" as const,
      route: "/(tabs)/split-rooms" as const,
    }));
}

export function buildWalletNotifications(
  walletData?: WalletSummaryResponse | null,
): LiveNotificationItem[] {
  if (!walletData?.summary) return [];
  const items: LiveNotificationItem[] = [];

  if (Number(walletData.summary.pendingIncoming || 0) > 0) {
    items.push({
      id: `wallet-incoming-${Number(walletData.summary.pendingIncoming || 0).toFixed(2)}`,
      title: "Money to receive",
      detail: "You have pending incoming settlements.",
      amount: Number(walletData.summary.pendingIncoming || 0),
      kind: "wallet",
      route: "/(tabs)/wallet",
    });
  }

  if (Number(walletData.summary.pendingOutgoing || 0) > 0) {
    items.push({
      id: `wallet-outgoing-${Number(walletData.summary.pendingOutgoing || 0).toFixed(2)}`,
      title: "Money to pay",
      detail: "You have pending outgoing settlements.",
      amount: Number(walletData.summary.pendingOutgoing || 0),
      kind: "wallet",
      route: "/(tabs)/wallet",
    });
  }

  return items;
}

export function getNotificationSignature(items: LiveNotificationItem[] = []) {
  return items
    .map((item) => `${item.id}:${item.amount ?? ""}`)
    .sort()
    .join("|");
}

export async function getSeenNotificationSignature() {
  return (await SecureStore.getItemAsync(SEEN_NOTIFICATIONS_KEY)) ?? "";
}

export async function markNotificationSignatureSeen(signature: string) {
  await SecureStore.setItemAsync(SEEN_NOTIFICATIONS_KEY, signature);
}

export async function hasUnseenNotifications(
  items: LiveNotificationItem[] = [],
) {
  const signature = getNotificationSignature(items);
  if (!signature) return false;
  const seenSignature = await getSeenNotificationSignature();
  return signature !== seenSignature;
}
