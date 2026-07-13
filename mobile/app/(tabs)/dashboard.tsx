import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Avatar from "../../src/components/Avatar";
import Screen from "../../src/components/Screen";
import SpendBarChart, {
  type SpendGraphMode,
  type SpendGraphPoint,
} from "../../src/components/SpendBarChart";
import Text from "../../src/components/LocalizedText";
import StatCard from "../../src/components/StatCard";
import { DashboardSkeleton } from "../../src/components/PageSkeletons";
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
import {
  getNotificationSignature,
  getSeenNotificationSignature,
  buildFriendNotifications,
  buildRoomNotifications,
} from "../../src/lib/notificationSignals";
import {
  getSpendTransactions,
  getTransactionDisplayAmount,
  normalizeTransactionsForDisplay,
} from "../../src/lib/transactionDisplay";
import { fontFamilies } from "../../src/theme/fonts";
import { showErrorAlert } from "../../src/lib/errors";
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
    const createdAt = new Date(
      transaction.createdAt ||
        transaction.displayDate ||
        new Date().toISOString(),
    );

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
  const { avatarId, formatCurrency, theme } = useAppSettings();
  const [summary, setSummary] = useState<DashboardSummary | null>(
    dashboardCache?.summary ?? null,
  );
  const [friendsSummary, setFriendsSummary] = useState<FriendsSummary | null>(
    dashboardCache?.friendsSummary ?? null,
  );
  const [rooms, setRooms] = useState<SplitRoom[]>(dashboardCache?.rooms ?? []);
  const [transactions, setTransactions] = useState<TransactionItem[]>(
    dashboardCache?.transactions ?? [],
  );
  const [graphMode, setGraphMode] = useState<SpendGraphMode>("yearly");
  const [selectedGraphIndex, setSelectedGraphIndex] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(!dashboardCache);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const expenseModalScrollRef = useRef<ScrollView>(null);

  const displayName =
    dbUser?.display_name ||
    dbUser?.name ||
    user?.displayName ||
    "SplitVerse user";

  const displayEmail = dbUser?.email || user?.email || "";
  const username = dbUser?.username ? `@${dbUser.username}` : displayEmail;
  const photoUrl =
    avatarId === "initials"
      ? undefined
      : dbUser?.display_photo_url ||
        dbUser?.profile_photo_url ||
        dbUser?.photo_url ||
        undefined;

  const walletBalance =
    summary?.walletHealth?.availableBalance ??
    summary?.metrics?.walletBalance ??
    dbUser?.wallet_balance ??
    0;

  const todayExpense =
    summary?.expenseTracker?.totalSpentToday ??
    summary?.metrics?.todayExpense ??
    0;

  const monthlySpend =
    summary?.monthlySpend?.currentMonthTotal ??
    summary?.monthlySpend?.graphTotal ??
    0;

  const payable =
    summary?.walletHealth?.payable ?? summary?.metrics?.pendingPayment ?? 0;

  const receivable = summary?.walletHealth?.receivable ?? 0;

  const netPosition =
    summary?.walletHealth?.netPosition ?? receivable - payable;

  const friendCount = friendsSummary?.friends.length ?? 0;
  const roomCount = rooms.length;
  const expenseActionColor = theme.mode === "dark" ? "#F59E0B" : "#2563EB";
  const modalTextColor = theme.mode === "dark" ? "#F8FAFC" : "#111827";
  const modalMutedColor = theme.mode === "dark" ? "#A8B0BC" : "#667085";

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

  const selectedGraphPoint =
    selectedGraphIndex === null
      ? null
      : (graphData[selectedGraphIndex] ?? null);

  const graphSummaryLabel = selectedGraphPoint
    ? `Total ${selectedGraphPoint.label}: ${formatCurrency(selectedGraphPoint.amount)}`
    : `Total: ${formatCurrency(graphTotal)}`;

  useEffect(() => {
    setSelectedGraphIndex(null);
  }, [graphMode]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);

      setTimeout(() => {
        expenseModalScrollRef.current?.scrollToEnd({ animated: true });
      }, 160);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);

      // Reset the scroll position after the keyboard closes so the modal
      // returns to its normal centered position instead of leaving a gap.
      setTimeout(
        () => {
          expenseModalScrollRef.current?.scrollTo({ y: 0, animated: true });
        },
        Platform.OS === "ios" ? 120 : 80,
      );
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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

      const displayTransactions = normalizeTransactionsForDisplay(
        transactionData.transactions ?? [],
      );
      const notificationItems = [
        ...buildFriendNotifications(
          (friendsData.receivedRequests ?? []) as FriendRequest[],
        ),
        ...buildRoomNotifications(roomsData.rooms ?? []),
        ...(Number(dashboardData.walletHealth?.receivable || 0) > 0
          ? [
              {
                id: `wallet-incoming-${Number(dashboardData.walletHealth?.receivable || 0).toFixed(2)}`,
                title: "Money to receive",
                detail: "You have pending incoming settlements.",
                amount: Number(dashboardData.walletHealth?.receivable || 0),
                kind: "wallet" as const,
                route: "/(tabs)/wallet" as const,
              },
            ]
          : []),
        ...(Number(dashboardData.walletHealth?.payable || 0) > 0
          ? [
              {
                id: `wallet-outgoing-${Number(dashboardData.walletHealth?.payable || 0).toFixed(2)}`,
                title: "Money to pay",
                detail: "You have pending outgoing settlements.",
                amount: Number(dashboardData.walletHealth?.payable || 0),
                kind: "wallet" as const,
                route: "/(tabs)/wallet" as const,
              },
            ]
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
      setHasUnreadNotifications(
        Boolean(
          notificationSignature &&
          notificationSignature !== seenNotificationSignature,
        ),
      );
    } catch (error) {
      if (!silent) {
        showErrorAlert(error, {
          title: "Could not load dashboard",
          fallbackMessage:
            "Your dashboard data could not be loaded. Pull down to try again.",
        });
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

  useEffect(() => {
    const timer = setInterval(() => {
      void loadDashboardData(true);
    }, 9000);

    return () => clearInterval(timer);
  }, [loadDashboardData]);

  if (loading && !dashboardCache) {
    return (
      <Screen
        scroll={false}
        safeBackgroundColor={
          theme.mode === "dark" ? theme.background : theme.primary
        }
      >
        <DashboardSkeleton />
      </Screen>
    );
  }

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
      await Promise.all([
        createExpense({
          title: expenseTitle.trim(),
          amount,
          expenseDate: getTodayIsoDate(),
        }),
        new Promise((resolve) => setTimeout(resolve, 450)),
      ]);
      setExpenseTitle("");
      setExpenseAmount("");
      await loadDashboardData(true);
      setExpenseModalVisible(false);
      Alert.alert(
        "Expense added",
        "Today's expense, graph, and transaction history were updated.",
      );
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not add expense",
        fallbackMessage:
          "Today's expense could not be saved. Check your connection and try again.",
      });
    } finally {
      setSavingExpense(false);
    }
  }

  function closeExpenseModal() {
    if (!savingExpense) {
      Keyboard.dismiss();
      setKeyboardVisible(false);
      expenseModalScrollRef.current?.scrollTo({ y: 0, animated: false });
      setExpenseModalVisible(false);
    }
  }

  function openExpenseModal() {
    setKeyboardVisible(false);
    expenseModalScrollRef.current?.scrollTo({ y: 0, animated: false });
    setExpenseModalVisible(true);
  }

  function renderHeroActions() {
    return (
      <View style={styles.heroActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add today's expense"
          style={({ pressed }) => [
            styles.addExpenseIconButton,
            {
              backgroundColor: expenseActionColor,
              borderColor: expenseActionColor,
              opacity: pressed ? 0.84 : 1,
            },
          ]}
          onPress={openExpenseModal}
        >
          <Ionicons name="add" size={25} color="#fff" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          style={[styles.notificationButton]}
          onPress={() => router.push("/(tabs)/notifications")}
        >
          <Ionicons name="notifications-outline" size={22} color="#fff" />
          {hasUnreadNotifications ? (
            <View style={styles.notificationDot} />
          ) : null}
        </Pressable>
      </View>
    );
  }

  return (
    <Screen
      refreshing={loading}
      onRefresh={() => loadDashboardData()}
      safeBackgroundColor={
        theme.mode === "dark" ? theme.background : theme.primary
      }
      contentStyle={[
        styles.screen,
        {
          backgroundColor: theme.background,
          paddingBottom: spacing.xxl + 50,
        },
      ]}
    >
      <Pressable
        style={styles.pageTapReset}
        onPress={() => setSelectedGraphIndex(null)}
      >
        <View style={styles.heroClip}>
          {photoUrl ? (
            <ImageBackground
              source={{ uri: photoUrl }}
              blurRadius={28}
              style={styles.heroImage}
              imageStyle={styles.heroImageInner}
            >
              <LinearGradient
                colors={
                  theme.mode === "dark"
                    ? ["rgba(0,0,0,0.30)", "rgba(0, 0, 0, 0.86)"]
                    : ["rgba(255, 255, 255, 0.08)", "rgb(255, 255, 255)"]
                }
                style={styles.heroOverlay}
              >
                <View style={styles.heroTop}>
                  <View>
                    <Text style={styles.heroTitle}>Dashboard</Text>
                  </View>

                  {renderHeroActions()}
                </View>

                <View style={styles.profileBlock}>
                  <Avatar
                    name={displayName}
                    email={displayEmail}
                    imageUrl={photoUrl}
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
            </ImageBackground>
          ) : (
            <LinearGradient
              colors={
                theme.mode === "dark"
                  ? ["#050608", "#111318"]
                  : [theme.primary, theme.primaryActive]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroOverlay}
            >
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroTitle}>Dashboard</Text>
                </View>

                {renderHeroActions()}
              </View>

              <View style={styles.profileBlock}>
                <Avatar
                  name={displayName}
                  email={displayEmail}
                  imageUrl={photoUrl}
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
          )}
        </View>

        <View
          style={[
            styles.identityStats,
            { borderColor: theme.border, backgroundColor: theme.card },
          ]}
        >
          <View style={styles.identityStat}>
            <Text style={styles.identityValue}>{friendCount}</Text>
            <Text style={styles.identityLabel}>Friends</Text>
          </View>

          <View
            style={[
              styles.identityDivider,
              { backgroundColor: theme.borderSoft },
            ]}
          />

          <View style={styles.identityStat}>
            <Text style={styles.identityValue}>{roomCount}</Text>
            <Text style={styles.identityLabel}>Rooms</Text>
          </View>

          <View
            style={[
              styles.identityDivider,
              { backgroundColor: theme.borderSoft },
            ]}
          />

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
          title={
            graphMode === "weekly"
              ? "Weekly spending graph"
              : "Yearly spending graph"
          }
          totalLabel={graphSummaryLabel}
          mode={graphMode}
          onModeChange={setGraphMode}
          data={graphData}
          selectedIndex={selectedGraphIndex}
          onSelectPoint={(_, index) => setSelectedGraphIndex(index)}
        />
      </Pressable>
      <Modal
        visible={expenseModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onShow={() => {
          setKeyboardVisible(false);
          expenseModalScrollRef.current?.scrollTo({ y: 0, animated: false });
        }}
        onRequestClose={closeExpenseModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeExpenseModal}
          />

          <KeyboardAvoidingView
            style={styles.modalKeyboardView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={expenseModalScrollRef}
              style={styles.modalScrollView}
              contentContainerStyle={[
                styles.modalScrollContent,
                keyboardVisible && styles.modalScrollContentKeyboard,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View
                style={[
                  styles.expenseModalCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleBlock}>
                    <Text
                      style={[styles.modalEyebrow, { color: modalMutedColor }]}
                    >
                      TODAY'S EXPENSE
                    </Text>
                    <Text
                      style={[styles.modalTitle, { color: modalTextColor }]}
                    >
                      Add an expense
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close expense form"
                    disabled={savingExpense}
                    style={({ pressed }) => [
                      styles.modalCloseButton,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        opacity: pressed ? 0.68 : savingExpense ? 0.45 : 1,
                      },
                    ]}
                    onPress={closeExpenseModal}
                  >
                    <Ionicons name="close" size={22} color={modalTextColor} />
                  </Pressable>
                </View>

                <Text
                  style={[styles.modalDescription, { color: modalMutedColor }]}
                >
                  This updates today's total, your spending graph, and
                  transaction history.
                </Text>

                <View style={styles.expenseFormFields}>
                  <View style={styles.expenseField}>
                    <Text
                      style={[
                        styles.expenseFieldLabel,
                        { color: modalTextColor },
                      ]}
                    >
                      Expense title
                    </Text>
                    <TextInput
                      value={expenseTitle}
                      onChangeText={setExpenseTitle}
                      placeholder="Lunch, fuel, groceries"
                      placeholderTextColor={modalMutedColor}
                      selectionColor={expenseActionColor}
                      editable={!savingExpense}
                      returnKeyType="next"
                      style={[
                        styles.expenseTextInput,
                        {
                          backgroundColor: theme.background,
                          borderColor: theme.border,
                          color: modalTextColor,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.expenseField}>
                    <Text
                      style={[
                        styles.expenseFieldLabel,
                        { color: modalTextColor },
                      ]}
                    >
                      Amount
                    </Text>
                    <TextInput
                      value={expenseAmount}
                      onChangeText={setExpenseAmount}
                      keyboardType="decimal-pad"
                      placeholder="250"
                      placeholderTextColor={modalMutedColor}
                      selectionColor={expenseActionColor}
                      editable={!savingExpense}
                      returnKeyType="done"
                      style={[
                        styles.expenseTextInput,
                        {
                          backgroundColor: theme.background,
                          borderColor: theme.border,
                          color: modalTextColor,
                        },
                      ]}
                      onFocus={() => {
                        setKeyboardVisible(true);
                        setTimeout(() => {
                          expenseModalScrollRef.current?.scrollToEnd({
                            animated: true,
                          });
                        }, 220);
                      }}
                    />
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add expense"
                  disabled={savingExpense}
                  style={({ pressed }) => [
                    styles.expenseSubmitButton,
                    {
                      backgroundColor: expenseActionColor,
                      opacity: pressed && !savingExpense ? 0.86 : 1,
                    },
                  ]}
                  onPress={handleCreateExpense}
                >
                  {savingExpense ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.expenseSubmitText}>
                        Adding expense
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="add-circle-outline"
                        size={21}
                        color="#fff"
                      />
                      <Text style={styles.expenseSubmitText}>Add expense</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    paddingBottom: spacing.xxl + 50,
    backgroundColor: colors.surfaceSoft,
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
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  addExpenseIconButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationButton: {
    minHeight: 42,
    minWidth: 42,
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
  heroClip: {
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroImage: {
    minHeight: 218,
  },
  heroImageInner: {
    opacity: 0.95,
  },
  heroOverlay: {
    minHeight: 218,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    justifyContent: "flex-end",
  },
  pageTapReset: {
    flexGrow: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + 72,
  },
  modalScrollContentKeyboard: {
    justifyContent: "flex-start",
    paddingTop: 28,
    paddingBottom: 28,
  },
  expenseModalCard: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  modalTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  modalEyebrow: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  modalTitle: {
    marginTop: spacing.xs,
    ...typography.titleMd,
  },
  modalDescription: {
    marginTop: spacing.sm,
    ...typography.bodySm,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  expenseFormFields: {
    gap: spacing.base,
    marginTop: spacing.lg,
  },
  expenseField: {
    gap: spacing.sm,
  },
  expenseFieldLabel: {
    ...typography.bodySm,
    fontWeight: "600",
  },
  expenseTextInput: {
    width: "100%",
    height: 56,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: 0,
    fontSize: 16,
    lineHeight: 20,
    textAlignVertical: "center",
    fontFamily: fontFamilies.libreRegular,
    fontWeight: "400",
  },
  expenseSubmitButton: {
    minHeight: 52,
    marginTop: spacing.lg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  expenseSubmitText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
});
