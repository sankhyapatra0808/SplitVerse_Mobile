import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AmountText from "../../src/components/AmountText";
import AppCard from "../../src/components/AppCard";
import Avatar from "../../src/components/Avatar";
import EmptyState from "../../src/components/EmptyState";
import Screen from "../../src/components/Screen";
import Text from "../../src/components/LocalizedText";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import {
  getFriendsSummary,
  getSplitRooms,
  getWalletSummary,
  type WalletSummaryResponse,
} from "../../src/lib/api";
import {
  buildFriendNotifications,
  buildRoomNotifications,
  buildWalletNotifications,
  getNotificationSignature,
  markNotificationSignatureSeen,
  type LiveNotificationItem,
} from "../../src/lib/notificationSignals";
import { radius, spacing, typography } from "../../src/theme/tokens";

let notificationCache: LiveNotificationItem[] | null = null;
let walletCache: WalletSummaryResponse | null = null;

export default function Notifications() {
  const { user, dbUser } = useAuth();
  const { theme, formatCurrency } = useAppSettings();
  const [items, setItems] = useState<LiveNotificationItem[]>(notificationCache ?? []);
  const [wallet, setWallet] = useState<WalletSummaryResponse | null>(walletCache);
  const [loading, setLoading] = useState(!notificationCache);

  const displayName = dbUser?.display_name || dbUser?.name || user?.displayName || "SplitVerse user";
  const email = dbUser?.email || user?.email || "";

  const loadNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent && !notificationCache) setLoading(true);
      const [friendsData, roomsData, walletData] = await Promise.all([
        getFriendsSummary(),
        getSplitRooms(),
        getWalletSummary(),
      ]);

      const nextItems: LiveNotificationItem[] = [
        ...buildFriendNotifications(friendsData.receivedRequests ?? []),
        ...buildRoomNotifications(roomsData.rooms ?? []),
        ...buildWalletNotifications(walletData),
      ];

      const signature = getNotificationSignature(nextItems);
      await markNotificationSignatureSeen(signature);

      notificationCache = nextItems;
      walletCache = walletData;
      setItems(nextItems);
      setWallet(walletData);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications(Boolean(notificationCache));
    }, [loadNotifications]),
  );

  function openNotification(item: LiveNotificationItem) {
    router.push(item.route as never);
  }

  return (
    <Screen
      refreshing={loading}
      onRefresh={() => loadNotifications(false)}
      safeBackgroundColor={theme.primary}
      contentStyle={[styles.screen, { backgroundColor: theme.background }]}
    >
      <LinearGradient colors={[theme.primary, theme.primaryActive]} style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable accessibilityLabel="Back" style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#ffffff" />
          </Pressable>

          <View style={styles.bellCircle}>
            <Ionicons name="notifications" size={21} color="#ffffff" />
          </View>
        </View>

        <View style={styles.userRow}>
          <Avatar
            name={displayName}
            email={email}
            imageUrl={dbUser?.display_photo_url || dbUser?.profile_photo_url || dbUser?.photo_url}
            size={62}
          />
          <View style={styles.userCopy}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{email}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>Notifications</Text>
            <Text style={styles.summaryValue}>{items.length}</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>Net position</Text>
            <Text style={styles.summaryValue}>{formatCurrency(wallet?.summary.netPosition ?? 0, { compact: true })}</Text>
          </View>
        </View>
      </LinearGradient>

      <AppCard style={styles.card}>
        <Text style={[styles.cardEyebrow, { color: theme.body }]}>Today</Text>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Notifications and reminders</Text>

        {items.length === 0 ? (
          <EmptyState title="No notifications" message="Friend requests, dues, and wallet reminders will appear here." />
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <Pressable
                style={({ pressed }) => [
                  styles.notificationRow,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  },
                ]}
                key={item.id}
                onPress={() => openNotification(item)}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}> 
                  <Ionicons
                    name={item.kind === "friend" ? "person-add" : item.kind === "wallet" ? "wallet" : "receipt"}
                    size={18}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.rowText, { color: theme.body }]}>{item.detail}</Text>
                </View>
                {item.amount ? <AmountText amount={item.amount} size="sm" tone="primary" /> : null}
                <Ionicons name="chevron-forward" size={17} color={theme.muted} />
              </Pressable>
            ))}
          </View>
        )}
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.base,
    paddingTop: 0,
  },
  hero: {
    marginHorizontal: -spacing.base,
    marginTop: -spacing.base,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    gap: spacing.base,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  bellCircle: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  userCopy: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: "#ffffff",
    ...typography.titleMd,
  },
  userEmail: {
    color: "rgba(255,255,255,0.76)",
    ...typography.bodySm,
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  summaryPill: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: "rgba(255,255,255,0.14)",
    padding: spacing.sm,
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.76)",
    ...typography.caption,
  },
  summaryValue: {
    marginTop: 2,
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  card: {
    gap: spacing.base,
  },
  cardEyebrow: {
    ...typography.caption,
  },
  cardTitle: {
    ...typography.titleMd,
  },
  list: {
    gap: spacing.sm,
  },
  notificationRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  iconCircle: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    ...typography.titleSm,
  },
  rowText: {
    ...typography.bodySm,
  },
});
