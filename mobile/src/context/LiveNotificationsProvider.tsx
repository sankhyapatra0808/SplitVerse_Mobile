import { router } from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
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
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState === null || AppState.currentState === "active",
  );

  const knownSignatureRef = useRef("");
  const firstLoadDoneRef = useRef(false);
  const refreshInProgressRef = useRef(false);
  const lastErrorMessageRef = useRef("");

  const resetNotificationState = useCallback(() => {
    firstLoadDoneRef.current = false;
    knownSignatureRef.current = "";
    refreshInProgressRef.current = false;
    lastErrorMessageRef.current = "";
    setToast(null);
  }, []);

  const loadNotificationItems = useCallback(async () => {
    if (!appIsActive || initializing || !user || !dbUser) {
      return;
    }

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

      const signature = getNotificationSignature(items);

      // The first successful load establishes a baseline and must not replay
      // existing activity as new notifications when the app starts.
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
  }, [appIsActive, dbUser, initializing, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppIsActive(nextState === "active");
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!user) {
      resetNotificationState();
      return;
    }

    if (!appIsActive || initializing || !dbUser) {
      return;
    }

    const handleBackgroundError = (error: unknown) => {
      const appError = normalizeAppError(error, {
        title: "Notification refresh failed",
        fallbackMessage:
          "Live notifications could not be refreshed in the background.",
      });

      if (lastErrorMessageRef.current !== appError.message) {
        if (__DEV__) {
          console.warn("Live notification refresh delayed:", appError.message);
        }
        lastErrorMessageRef.current = appError.message;
      }
    };

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
    appIsActive,
    dbUser,
    initializing,
    loadNotificationItems,
    resetNotificationState,
    user,
  ]);

  return (
    <>
      {children}
      <AppToast toast={toast} onHide={() => setToast(null)} />
    </>
  );
}
