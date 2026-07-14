import { router } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AppToast, { type AppToastPayload } from "../components/AppToast";
import { normalizeAppError } from "../lib/errors";
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
const INITIAL_REFRESH_DELAY_MS = 1200;

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

export default function LiveNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, dbUser, initializing } = useAuth();

  const [toast, setToast] = useState<AppToastPayload | null>(null);

  const knownSignatureRef = useRef("");
  const firstLoadDoneRef = useRef(false);
  const latestItemsRef = useRef<LiveNotificationItem[]>([]);
  const refreshInProgressRef = useRef(false);
  const lastErrorMessageRef = useRef("");

  const resetNotificationState = useCallback(() => {
    firstLoadDoneRef.current = false;
    knownSignatureRef.current = "";
    latestItemsRef.current = [];
    refreshInProgressRef.current = false;
    lastErrorMessageRef.current = "";
    setToast(null);
  }, []);

  const loadNotificationItems = useCallback(async () => {
    /*
     * Do not request notification data while Firebase is restoring the
     * session or while the database user is still being synchronized.
     */
    if (initializing || !user || !dbUser) {
      return;
    }

    /*
     * The timer, focus refresh, or another event may request a refresh at
     * nearly the same time. Ignore it while one refresh is already running.
     */
    if (refreshInProgressRef.current) {
      return;
    }

    refreshInProgressRef.current = true;

    try {
      const [friendsData, roomsData, walletData] = await Promise.all([
        getFriendsSummary(),
        getSplitRooms(),
        getWalletSummary(),
      ]);

      const items: LiveNotificationItem[] = [
        ...buildFriendNotifications(friendsData.receivedRequests ?? []),
        ...buildRoomNotifications(roomsData.rooms ?? []),
        ...buildWalletNotifications(walletData as WalletSummaryResponse),
      ];

      latestItemsRef.current = items;

      const signature = getNotificationSignature(items);

      /*
       * Do not display old notifications as new notifications when the app
       * starts. The first successful load only creates the initial baseline.
       */
      if (!firstLoadDoneRef.current) {
        knownSignatureRef.current = signature;
        firstLoadDoneRef.current = true;
        lastErrorMessageRef.current = "";
        return;
      }

      if (signature && signature !== knownSignatureRef.current) {
        const knownIds = new Set(
          knownSignatureRef.current
            .split("|")
            .map((part) => part.split(":")[0])
            .filter(Boolean),
        );

        const newItem =
          items.find((item) => !knownIds.has(item.id)) || items[0];

        if (newItem) {
          setToast(buildToast(newItem));
        }

        knownSignatureRef.current = signature;
      }

      lastErrorMessageRef.current = "";
    } finally {
      refreshInProgressRef.current = false;
    }
  }, [dbUser, initializing, user]);

  useEffect(() => {
    /*
     * Clear notification state after logout. During normal startup, wait for
     * AuthContext to finish synchronizing the database user.
     */
    if (!user) {
      resetNotificationState();
      return;
    }

    if (initializing || !dbUser) {
      return;
    }

    const handleBackgroundError = (error: unknown) => {
      const appError = normalizeAppError(error, {
        title: "Notification refresh failed",
        fallbackMessage:
          "Live notifications could not be refreshed in the background.",
      });

      /*
       * Avoid repeatedly printing the exact same warning every nine seconds
       * while the backend is temporarily waking up.
       */
      if (lastErrorMessageRef.current !== appError.message) {
        console.warn("Live notification refresh delayed:", appError.message);
        lastErrorMessageRef.current = appError.message;
      }
    };

    /*
     * Give AuthContext a brief moment to complete the initial account sync
     * before starting the three notification requests.
     */
    const initialRefreshTimer = setTimeout(() => {
      void loadNotificationItems().catch(handleBackgroundError);
    }, INITIAL_REFRESH_DELAY_MS);

    const pollingTimer = setInterval(() => {
      void loadNotificationItems().catch(handleBackgroundError);
    }, POLL_MS);

    return () => {
      clearTimeout(initialRefreshTimer);
      clearInterval(pollingTimer);
    };
  }, [
    dbUser,
    initializing,
    loadNotificationItems,
    resetNotificationState,
    user,
  ]);

  const value = useMemo(() => children, [children]);

  return (
    <>
      {value}
      <AppToast toast={toast} onHide={() => setToast(null)} />
    </>
  );
}