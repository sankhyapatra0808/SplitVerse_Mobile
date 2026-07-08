import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback,
  useEffect,
  useMemo,
  useState } from "react";
import { Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import AmountText from "../../src/components/AmountText";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Avatar from "../../src/components/Avatar";
import Screen from "../../src/components/Screen";
import SpendBarChart, {
  type SpendGraphMode,
  type SpendGraphPoint,
} from "../../src/components/SpendBarChart";
import Text from "../../src/components/LocalizedText";
import StatCard from "../../src/components/StatCard";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import {
  createExpense,
  getDashboardSummary,
  getFriendsSummary,
  getSplitRooms,
  getTransactions,
  type FriendRequest,
  type DashboardSummary,
  type FriendsSummary,
  type SplitRoom,
  type TransactionItem,
} from "../../src/lib/api";
import { getNotificationSignature, getSeenNotificationSignature, buildFriendNotifications, buildRoomNotifications } from "../../src/lib/notificationSignals";
import { getSpendTransactions, getTransactionDisplayAmount, normalizeTransactionsForDisplay } from "../../src/lib/transactionDisplay";
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

let dashboardCache: {
  summary: DashboardSummary | null;
  friendsSummary: FriendsSummary | null;
  rooms: SplitRoom[];
  transactions: TransactionItem[];
} | null = null;

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value?: number | null) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildWeeklySpend(transactions: TransactionItem[]): SpendGraphPoint[] {
  const today = new Date();

  const sunday = new Date(today);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(today.getDate() - today.getDay());

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);

    return {
      date,
      key: getDateKey(date),
      label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][index],
      amount: 0,
    };
  });

  const dayMap = new Map(days.map((day) => [day.key, day]));

  getSpendTransactions(transactions).forEach((transaction) => {
    const createdAt = new Date(transaction.createdAt || transaction.displayDate || new Date().toISOString());

    if (Number.isNaN(createdAt.getTime())) {
      return;
    }

    const key = getDateKey(createdAt);
    const day = dayMap.get(key);

    if (!day) {
      return;
    }

    day.amount += Math.abs(getTransactionDisplayAmount(transaction));
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
  const { formatCurrency, theme } = useAppSettings();
  const [summary, setSummary] = useState<DashboardSummary | null>(dashboardCache?.summary ?? null);
  const [friendsSummary, setFriendsSummary] = useState<FriendsSummary | null>(dashboardCache?.friendsSummary ?? null);
  const [rooms, setRooms] = useState<SplitRoom[]>(dashboardCache?.rooms ?? []);
  const [transactions, setTransactions] = useState<TransactionItem[]>(dashboardCache?.transactions ?? []);
  const [graphMode, setGraphMode] = useState<SpendGraphMode>("yearly");
  const [loading, setLoading] = useState(!dashboardCache);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("General");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

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

  const loadDashboardData = useCallback(async (silent = false) => {
    try {
      if (!silent && !dashboardCache) setLoading(true);

      const [dashboardData, friendsData, roomsData, transactionData] =
        await Promise.all([
          getDashboardSummary(),
          getFriendsSummary(),
          getSplitRooms(),
          getTransactions({ limit: 1000 }),
        ]);

      const displayTransactions = normalizeTransactionsForDisplay(transactionData.transactions ?? []);
      const notificationItems = [
        ...buildFriendNotifications((friendsData.receivedRequests ?? []) as FriendRequest[]),
        ...buildRoomNotifications(roomsData.rooms ?? []),
        ...(Number(dashboardData.walletHealth?.receivable || 0) > 0
          ? [{
              id: `wallet-incoming-${Number(dashboardData.walletHealth?.receivable || 0).toFixed(2)}`,
              title: "Money to receive",
              detail: "You have pending incoming settlements.",
              amount: Number(dashboardData.walletHealth?.receivable || 0),
              kind: "wallet" as const,
              route: "/(tabs)/wallet" as const,
            }]
          : []),
        ...(Number(dashboardData.walletHealth?.payable || 0) > 0
          ? [{
              id: `wallet-outgoing-${Number(dashboardData.walletHealth?.payable || 0).toFixed(2)}`,
              title: "Money to pay",
              detail: "You have pending outgoing settlements.",
              amount: Number(dashboardData.walletHealth?.payable || 0),
              kind: "wallet" as const,
              route: "/(tabs)/wallet" as const,
            }]
          : []),
      ];
      const notificationSignature = getNotificationSignature(notificationItems);
      const seenNotificationSignature = await getSeenNotificationSignature();

      dashboardCache = {
        summary: dashboardData,
        friendsSummary: friendsData,
        rooms: roomsData.rooms,
        transactions: displayTransactions,
      };
      setSummary(dashboardData);
      setFriendsSummary(friendsData);
      setRooms(roomsData.rooms);
      setTransactions(displayTransactions);
      setHasUnreadNotifications(Boolean(notificationSignature && notificationSignature !== seenNotificationSignature));
    } catch (error) {
      if (!silent) {
        Alert.alert(
          "Dashboard failed",
          error instanceof Error ? error.message : "Could not load dashboard",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData(Boolean(dashboardCache));
  }, [loadDashboardData]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboardData(true);
    }, [loadDashboardData]),
  );


  async function handleCreateExpense() {
    const amount = Number(expenseAmount);
    if (!expenseTitle.trim()) {
      Alert.alert("Expense title required", "Enter what you spent on today.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid expense amount.");
      return;
    }

    try {
      setSavingExpense(true);
      await createExpense({
        title: expenseTitle.trim(),
        category: expenseCategory.trim() || "General",
        amount,
        expenseDate: getTodayIsoDate(),
      });
      setExpenseTitle("");
      setExpenseCategory("General");
      setExpenseAmount("");
      await loadDashboardData(true);
      Alert.alert("Expense added", "Today's expense, graph, and transaction history were updated.");
    } catch (error) {
      Alert.alert("Expense failed", error instanceof Error ? error.message : "Could not add expense.");
    } finally {
      setSavingExpense(false);
    }
  }

  return (
    <Screen
      refreshing={loading}
      onRefresh={() => loadDashboardData()}
      safeBackgroundColor={theme.primary}
      contentStyle={[styles.screen, { backgroundColor: theme.background }]}
    >
      <LinearGradient
        colors={[theme.primary, theme.primaryActive]}
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
            style={[styles.notificationButton, { backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.28)" }]}
            onPress={() => router.push("/(tabs)/notifications")}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {hasUnreadNotifications ? <View style={styles.notificationDot} /> : null}
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

      <View style={[styles.identityStats, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <View style={styles.identityStat}>
          <Text style={styles.identityValue}>{friendCount}</Text>
          <Text style={styles.identityLabel}>Friends</Text>
        </View>

        <View style={[styles.identityDivider, { backgroundColor: theme.borderSoft }]} />

        <View style={styles.identityStat}>
          <Text style={styles.identityValue}>{roomCount}</Text>
          <Text style={styles.identityLabel}>Rooms</Text>
        </View>

        <View style={[styles.identityDivider, { backgroundColor: theme.borderSoft }]} />

        <View style={styles.identityStat}>
          <Text
            style={[
              styles.identityValue,
              netPosition >= 0 ? styles.positiveValue : styles.negativeValue,
            ]}
          >
            {formatCurrency(netPosition, { signed: true })}
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
        title={graphMode === "weekly" ? "Weekly spending graph" : "Yearly spending graph"}
        totalLabel={`Total: ${formatCurrency(graphTotal)}`}
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
        <Text style={styles.cardEyebrow}>Expense form</Text>
        <Text style={styles.cardTitle}>Did you spend anything today?</Text>
        <Text style={styles.cardText}>Add the expense here and it will update today's expense, graph data, and transaction history.</Text>

        <AppTextInput
          label="Expense title"
          value={expenseTitle}
          onChangeText={setExpenseTitle}
          placeholder="Lunch, fuel, groceries"
        />
        <AppTextInput
          label="Category"
          value={expenseCategory}
          onChangeText={setExpenseCategory}
          placeholder="Food"
        />
        <AppTextInput
          label="Amount"
          value={expenseAmount}
          onChangeText={setExpenseAmount}
          keyboardType="decimal-pad"
          placeholder="250"
        />
        <AppButton title={savingExpense ? "Adding expense" : "Add expense"} loading={savingExpense} onPress={handleCreateExpense} />
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
  notificationButton: {
    minHeight: 42,
    minWidth: 42,
    borderWidth: 1,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: spacing.base,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    right: 11,
    top: 10,
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "#ff5a5f",
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