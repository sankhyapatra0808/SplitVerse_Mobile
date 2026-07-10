import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AppToast, { type AppToastPayload } from "../components/AppToast";
import { useAuth } from "./AuthContext";
import {
  getFriendsSummary,
  getSplitRooms,
  getWalletSummary,
  type WalletSummaryResponse,
} from "../lib/api";
import {
  buildFriendNotifications,
  buildRoomNotifications,
  buildWalletNotifications,
  getNotificationSignature,
  type LiveNotificationItem,
} from "../lib/notificationSignals";

const POLL_MS = 9000;

function getToastIcon(item: LiveNotificationItem): AppToastPayload["icon"] {
  if (item.kind === "friend") return "person-add";
  if (item.kind === "wallet") return "wallet";
  return "receipt";
}

function buildToast(item: LiveNotificationItem): AppToastPayload {
  return {
    id: item.id,
    title: item.title,
    message: item.detail,
    icon: getToastIcon(item),
    onPress: () => router.push(item.route as never),
  };
}

export default function LiveNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [toast, setToast] = useState<AppToastPayload | null>(null);
  const knownSignatureRef = useRef("");
  const firstLoadDoneRef = useRef(false);
  const latestItemsRef = useRef<LiveNotificationItem[]>([]);

  const loadNotificationItems = useCallback(async () => {
    if (!user) {
      firstLoadDoneRef.current = false;
      knownSignatureRef.current = "";
      latestItemsRef.current = [];
      return;
    }

    const [friendsData, roomsData, walletData] = await Promise.all([
      getFriendsSummary(),
      getSplitRooms(),
      getWalletSummary(),
    ]);

    const items = [
      ...buildFriendNotifications(friendsData.receivedRequests ?? []),
      ...buildRoomNotifications(roomsData.rooms ?? []),
      ...buildWalletNotifications(walletData as WalletSummaryResponse),
    ];

    latestItemsRef.current = items;
    const signature = getNotificationSignature(items);

    if (!firstLoadDoneRef.current) {
      knownSignatureRef.current = signature;
      firstLoadDoneRef.current = true;
      return;
    }

    if (signature && signature !== knownSignatureRef.current) {
      const knownIds = new Set(knownSignatureRef.current.split("|").map((part) => part.split(":")[0]).filter(Boolean));
      const newItem = items.find((item) => !knownIds.has(item.id)) || items[0];
      if (newItem) setToast(buildToast(newItem));
      knownSignatureRef.current = signature;
    }
  }, [user]);

  useEffect(() => {
    void loadNotificationItems().catch(() => undefined);
    const timer = setInterval(() => {
      void loadNotificationItems().catch(() => undefined);
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [loadNotificationItems]);

  const value = useMemo(() => children, [children]);

  return (
    <>
      {value}
      <AppToast toast={toast} onHide={() => setToast(null)} />
    </>
  );
}
