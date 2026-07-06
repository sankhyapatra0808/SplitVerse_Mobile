import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import AmountText from "../../src/components/AmountText";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import Avatar from "../../src/components/Avatar";
import Screen from "../../src/components/Screen";
import SpendBarChart, {
  type SpendGraphMode,
  type SpendGraphPoint,
} from "../../src/components/SpendBarChart";
import StatCard from "../../src/components/StatCard";
import { useAuth } from "../../src/context/AuthContext";
import {
  getDashboardSummary,
  getFriendsSummary,
  getSplitRooms,
  getTransactions,
  type DashboardSummary,
  type FriendsSummary,
  type SplitRoom,
  type TransactionItem,
} from "../../src/lib/api";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatMoney(value?: number | null) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isSpendTransaction(transaction: TransactionItem) {
  const text = `${transaction.status} ${transaction.displayStatus ?? ""} ${
    transaction.type ?? ""
  } ${transaction.title ?? ""}`.toLowerCase();

  if (
    text.includes("top-up") ||
    text.includes("added") ||
    text.includes("credit") ||
    text.includes("received")
  ) {
    return false;
  }

  return Number(transaction.amount || 0) !== 0;
}

function buildWeeklySpend(transactions: TransactionItem[]): SpendGraphPoint[] {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    return {
      date,
      key: getDateKey(date),
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      amount: 0,
    };
  });

  const dayMap = new Map(days.map((day) => [day.key, day]));

  transactions.forEach((transaction) => {
    if (!isSpendTransaction(transaction)) {
      return;
    }

    const createdAt = new Date(transaction.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      return;
    }

    const key = getDateKey(createdAt);
    const day = dayMap.get(key);

    if (!day) {
      return;
    }

    day.amount += Math.abs(Number(transaction.amount || 0));
  });

  return days.map((day) => ({
    label: day.label,
    amount: Math.round((day.amount + Number.EPSILON) * 100) / 100,
  }));
}

function buildYearlySpend(summary: DashboardSummary | null): SpendGraphPoint[] {
  const months = summary?.monthlySpend?.months ?? [];

  if (months.length > 0) {
    return months.map((month) => ({
      label: month.label,
      amount: Number(month.amount || 0),
    }));
  }

  return MONTH_LABELS.map((label) => ({
    label,
    amount: 0,
  }));
}

export default function Dashboard() {
  const { user, dbUser } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [friendsSummary, setFriendsSummary] = useState<FriendsSummary | null>(
    null,
  );
  const [rooms, setRooms] = useState<SplitRoom[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [graphMode, setGraphMode] = useState<SpendGraphMode>("yearly");
  const [loading, setLoading] = useState(true);

  const displayName =
    dbUser?.display_name || dbUser?.name || user?.displayName || "SplitVerse user";

  const displayEmail = dbUser?.email || user?.email || "";
  const username = dbUser?.username ? `@${dbUser.username}` : displayEmail;

  const walletBalance =
    summary?.walletHealth?.availableBalance ??
    summary?.metrics?.walletBalance ??
    dbUser?.wallet_balance ??
    0;

  const todayExpense =
    summary?.expenseTracker?.totalSpentToday ?? summary?.metrics?.todayExpense ?? 0;

  const monthlySpend =
    summary?.monthlySpend?.currentMonthTotal ??
    summary?.monthlySpend?.graphTotal ??
    0;

  const payable =
    summary?.walletHealth?.payable ?? summary?.metrics?.pendingPayment ?? 0;

  const receivable = summary?.walletHealth?.receivable ?? 0;

  const netPosition = summary?.walletHealth?.netPosition ?? receivable - payable;

  const friendCount = friendsSummary?.friends.length ?? 0;
  const roomCount = rooms.length;

  const yearlyData = useMemo(() => buildYearlySpend(summary), [summary]);

  const weeklyData = useMemo(
    () => buildWeeklySpend(transactions),
    [transactions],
  );

  const graphData = graphMode === "weekly" ? weeklyData : yearlyData;

  const graphTotal = graphData.reduce(
    (sum, point) => sum + Number(point.amount || 0),
    0,
  );

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [dashboardData, friendsData, roomsData, transactionData] =
        await Promise.all([
          getDashboardSummary(),
          getFriendsSummary(),
          getSplitRooms(),
          getTransactions({ limit: 1000 }),
        ]);

      setSummary(dashboardData);
      setFriendsSummary(friendsData);
      setRooms(roomsData.rooms);
      setTransactions(transactionData.transactions);
    } catch (error) {
      Alert.alert(
        "Dashboard failed",
        error instanceof Error ? error.message : "Could not load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  return (
    <Screen
      refreshing={loading}
      onRefresh={loadDashboardData}
      contentStyle={styles.screen}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryActive]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroEyebrow}>SplitVerse</Text>
            <Text style={styles.heroTitle}>Dashboard</Text>
          </View>

          <Pressable
            style={styles.profileShortcut}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text style={styles.profileShortcutText}>Profile</Text>
          </Pressable>
        </View>

        <View style={styles.profileBlock}>
          <Avatar
            name={displayName}
            email={displayEmail}
            imageUrl={
              dbUser?.display_photo_url ||
              dbUser?.profile_photo_url ||
              dbUser?.photo_url
            }
            size={72}
          />

          <View style={styles.profileCopy}>
            <Text style={styles.name} numberOfLines={1}>
              Hi, {displayName}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {username}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.identityStats}>
        <View style={styles.identityStat}>
          <Text style={styles.identityValue}>{friendCount}</Text>
          <Text style={styles.identityLabel}>Friends</Text>
        </View>

        <View style={styles.identityDivider} />

        <View style={styles.identityStat}>
          <Text style={styles.identityValue}>{roomCount}</Text>
          <Text style={styles.identityLabel}>Rooms</Text>
        </View>

        <View style={styles.identityDivider} />

        <View style={styles.identityStat}>
          <Text
            style={[
              styles.identityValue,
              netPosition >= 0 ? styles.positiveValue : styles.negativeValue,
            ]}
          >
            {formatMoney(netPosition)}
          </Text>
          <Text style={styles.identityLabel}>Net</Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatCard
          label="Wallet balance"
          amount={walletBalance}
          helper="Available"
          tone="primary"
          style={styles.statTile}
        />

        <StatCard
          label="Today's expense"
          amount={todayExpense}
          helper="Today"
          tone="danger"
          style={styles.statTile}
        />

        <StatCard
          label="Payable"
          amount={payable}
          helper="You owe"
          tone="danger"
          style={styles.statTile}
        />

        <StatCard
          label="Receivable"
          amount={receivable}
          helper="You get"
          tone="success"
          style={styles.statTile}
        />
      </View>

      <SpendBarChart
        style={styles.chartCard}
        title={graphMode === "weekly" ? "Weekly spending graph" : "12 months spending graph"}
        totalLabel={`Total: ${formatMoney(graphTotal)}`}
        mode={graphMode}
        onModeChange={setGraphMode}
        data={graphData}
      />

      <AppCard style={styles.settlementCard}>
        <View style={styles.settlementHead}>
          <View style={styles.settlementCopy}>
            <Text style={styles.cardEyebrow}>Adjusted settlements</Text>
            <Text style={styles.cardTitle}>Final payable after adjustment</Text>
            <Text style={styles.cardText}>
              Cross-room dues are adjusted so you only pay the final net amount.
            </Text>
          </View>

          <AmountText
            amount={Math.max(0, payable)}
            size="md"
            tone={payable > 0 ? "danger" : "success"}
          />
        </View>

        <View style={styles.actions}>
          <AppButton
            title="Open rooms"
            onPress={() => router.push("/(tabs)/split-rooms")}
          />
          <AppButton
            title="Add money"
            variant="secondary"
            onPress={() => router.push("/(tabs)/wallet")}
          />
        </View>
      </AppCard>

      <AppCard style={styles.quickCard}>
        <Text style={styles.cardEyebrow}>Quick actions</Text>
        <Text style={styles.cardTitle}>Keep your splits updated</Text>

        <View style={styles.actions}>
          <AppButton
            title="Profile and friends"
            variant="secondary"
            onPress={() => router.push("/(tabs)/profile")}
          />
          <AppButton
            title="View wallet"
            variant="secondary"
            onPress={() => router.push("/(tabs)/wallet")}
          />
        </View>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surfaceSoft,
  },
  hero: {
    minHeight: 286,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.74)",
    ...typography.caption,
  },
  heroTitle: {
    marginTop: spacing.xs,
    color: colors.onPrimary,
    fontSize: 34,
    fontWeight: "400",
    lineHeight: 38,
    letterSpacing: -0.7,
  },
  profileShortcut: {
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: spacing.base,
    alignItems: "center",
    justifyContent: "center",
  },
  profileShortcutText: {
    color: colors.onPrimary,
    ...typography.caption,
  },
  profileBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
    marginTop: spacing.xxl,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.onPrimary,
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  email: {
    marginTop: spacing.xs,
    color: "rgba(255,255,255,0.78)",
    ...typography.bodySm,
  },
  identityStats: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.base,
    marginTop: -34,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.canvas,
    padding: spacing.base,
  },
  identityStat: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  identityValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  positiveValue: {
    color: colors.success,
  },
  negativeValue: {
    color: colors.danger,
  },
  identityLabel: {
    color: colors.body,
    ...typography.caption,
  },
  identityDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.hairlineSoft,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.base,
  },
  statTile: {
    width: "48%",
  },
  chartCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.xl,
  },
  settlementCard: {
    gap: spacing.base,
    marginHorizontal: spacing.base,
    marginTop: spacing.lg,
  },
  settlementHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  settlementCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickCard: {
    gap: spacing.base,
    marginHorizontal: spacing.base,
    marginTop: spacing.lg,
  },
  cardEyebrow: {
    color: colors.body,
    ...typography.caption,
  },
  cardTitle: {
    marginTop: spacing.xs,
    color: colors.ink,
    ...typography.titleMd,
  },
  cardText: {
    marginTop: spacing.xs,
    color: colors.body,
    ...typography.bodySm,
  },
  actions: {
    gap: spacing.sm,
  },
});