import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import AmountText from "../../src/components/AmountText";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import EmptyState from "../../src/components/EmptyState";
import LoadingState from "../../src/components/LoadingState";
import Screen from "../../src/components/Screen";
import SheetModal from "../../src/components/SheetModal";
import AppTextInput from "../../src/components/AppTextInput";
import {
  getRecentWalletTopUps,
  getWalletSummary,
  createRazorpayWalletOrder,
  verifyRazorpayWalletPayment,
  type PendingWalletSettlement,
  type WalletSummaryResponse,
  type WalletTopUpItem,
  type WalletTransactionItem,
} from "../../src/lib/api";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import RazorpayCheckout from "react-native-razorpay";

function formatMoney(value?: number | null) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedMoney(value?: number | null) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return "Unknown";

  const rawValue = String(dateValue);

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    const [year, month, day] = rawValue.split("-");
    return `${day}-${month}-${year}`;
  }

  const normalizedValue = rawValue.replace(" ", "T");
  const hasTimezone = /z$|[+-]\d{2}:?\d{2}$/i.test(normalizedValue);
  const date = new Date(hasTimezone ? normalizedValue : `${normalizedValue}Z`);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function getTransactionTitle(transaction: WalletTransactionItem) {
  if (transaction.description) return transaction.description;
  return transaction.type === "credit" ? "Wallet credit" : "Wallet debit";
}

function getSettlementPerson(settlement: PendingWalletSettlement) {
  if (settlement.direction === "incoming") {
    return settlement.fromName || settlement.fromEmail || "Friend";
  }

  return settlement.toName || settlement.toEmail || "Friend";
}

function getSettlementTitle(settlement: PendingWalletSettlement) {
  if (settlement.title) return settlement.title;
  if (settlement.roomName) return settlement.roomName;

  return settlement.direction === "incoming"
    ? `${getSettlementPerson(settlement)} owes you`
    : `You owe ${getSettlementPerson(settlement)}`;
}

export default function Wallet() {
  const [walletData, setWalletData] = useState<WalletSummaryResponse | null>(
    null,
  );
  const [topUps, setTopUps] = useState<WalletTopUpItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshingSilent, setRefreshingSilent] = useState(false);
  const [error, setError] = useState("");
  const [settlementsSheetOpen, setSettlementsSheetOpen] = useState(false);
  const [topUpsSheetOpen, setTopUpsSheetOpen] = useState(false);

  const summary = walletData?.summary;

  const availableBalance = summary?.availableBalance ?? 0;
  const pendingIncoming = summary?.pendingIncoming ?? 0;
  const pendingOutgoing = summary?.pendingOutgoing ?? 0;
  const netPosition = summary?.netPosition ?? 0;

  const recentTransactions = walletData?.recentWalletTransactions ?? [];
  const pendingSettlements = walletData?.pendingSettlements ?? [];

  const [topUpSheetOpen, setTopUpSheetOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [creatingTopUpOrder, setCreatingTopUpOrder] = useState(false);

  const incomingSettlements = useMemo(
    () =>
      pendingSettlements.filter(
        (settlement) => settlement.direction === "incoming",
      ),
    [pendingSettlements],
  );

  const outgoingSettlements = useMemo(
    () =>
      pendingSettlements.filter(
        (settlement) => settlement.direction === "outgoing",
      ),
    [pendingSettlements],
  );

  const latestTopUps = topUps.slice(0, 5);

  const walletHealthText = useMemo(() => {
    if (availableBalance <= 0 && pendingOutgoing > 0) {
      return "Low balance. Add money before paying dues.";
    }

    if (netPosition >= 0) {
      return "Healthy position. Your incoming and balance cover outgoing dues.";
    }

    return "You have more outgoing dues than incoming balance.";
  }, [availableBalance, netPosition, pendingOutgoing]);

  const walletHealthTone = useMemo(() => {
    if (availableBalance <= 0 && pendingOutgoing > 0) return "danger";
    if (netPosition >= 0) return "success";
    return "warning";
  }, [availableBalance, netPosition, pendingOutgoing]);

  const loadWallet = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshingSilent(true);
      }

      setError("");

      const [walletResponse, topUpsResponse] = await Promise.all([
        getWalletSummary(),
        getRecentWalletTopUps(),
      ]);

      setWalletData(walletResponse);
      setTopUps(topUpsResponse.topUps ?? []);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Could not load wallet details.";

      setError(message);

      if (!silent) {
        Alert.alert("Wallet failed", message);
      }
    } finally {
      setLoading(false);
      setRefreshingSilent(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  useFocusEffect(
    useCallback(() => {
      void loadWallet(true);
    }, [loadWallet]),
  );

  function handleTopUpPress() {
    setTopUpAmount("");
    setTopUpSheetOpen(true);
  }

async function handleCreateTopUpOrder() {
  const amount = Number(topUpAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    Alert.alert("Invalid amount", "Enter a valid top-up amount.");
    return;
  }

  if (amount < 10) {
    Alert.alert("Minimum amount", "Minimum wallet top-up amount is ₹10.");
    return;
  }

  try {
    setCreatingTopUpOrder(true);

    const order = await createRazorpayWalletOrder({
      amount,
      method: "UPI",
    });

    const payment = await RazorpayCheckout.open({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || "INR",
      name: order.name || "SplitVerse",
      description: order.description || "Wallet top-up",
      order_id: order.orderId,
      prefill: {
        name: order.prefill?.name,
        email: order.prefill?.email,
      },
      theme: {
        color: "#0052ff",
      },
    });

    await verifyRazorpayWalletPayment({
      razorpayOrderId: payment.razorpay_order_id,
      razorpayPaymentId: payment.razorpay_payment_id,
      razorpaySignature: payment.razorpay_signature,
    });

    setTopUpSheetOpen(false);
    setTopUpAmount("");
    await loadWallet(true);

    Alert.alert("Top-up successful", "Money has been added to your wallet.");
  } catch (error) {
    Alert.alert(
      "Payment failed",
      error instanceof Error ? error.message : "Could not complete wallet top-up",
    );
  } finally {
    setCreatingTopUpOrder(false);
  }
}

  if (loading && !walletData) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Loading wallet..." />
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={loading || refreshingSilent}
      onRefresh={() => loadWallet()}
      contentStyle={styles.screen}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Wallet</Text>
        <Text style={styles.title}>SplitVerse balance</Text>
        <Text style={styles.subtitle}>
          Track wallet balance, dues, settlements, and recent wallet activity.
        </Text>
      </View>

      {error ? (
        <AppCard style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not refresh wallet</Text>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton title="Try again" onPress={() => loadWallet()} />
        </AppCard>
      ) : null}

      <AppCard style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <View style={styles.balanceCopy}>
            <Text style={styles.cardEyebrow}>Available balance</Text>
            <Text style={styles.balanceAmount}>
              {formatMoney(availableBalance)}
            </Text>
            <Text style={styles.balanceHint}>
              Based on wallet credits and debits recorded in SplitVerse.
            </Text>
          </View>

          <View style={styles.walletBadge}>
            <Text style={styles.walletBadgeText}>INR</Text>
          </View>
        </View>

        <View
          style={[
            styles.healthPill,
            walletHealthTone === "success" && styles.healthSuccess,
            walletHealthTone === "danger" && styles.healthDanger,
            walletHealthTone === "warning" && styles.healthWarning,
          ]}
        >
          <Text
            style={[
              styles.healthText,
              walletHealthTone === "success" && styles.healthSuccessText,
              walletHealthTone === "danger" && styles.healthDangerText,
              walletHealthTone === "warning" && styles.healthWarningText,
            ]}
          >
            {walletHealthText}
          </Text>
        </View>

        <View style={styles.balanceActions}>
          <AppButton
            title="Add money"
            onPress={handleTopUpPress}
            style={styles.balanceActionButton}
          />
        </View>
      </AppCard>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pending incoming</Text>
          <AmountText amount={pendingIncoming} size="md" tone="success" />
          <Text style={styles.metricHelper}>Others owe you</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pending outgoing</Text>
          <AmountText
            amount={pendingOutgoing}
            size="md"
            tone={pendingOutgoing > 0 ? "danger" : "success"}
          />
          <Text style={styles.metricHelper}>You need to pay</Text>
        </View>

        <View style={[styles.metricCard, styles.netMetricCard]}>
          <Text style={styles.metricLabel}>Net position</Text>
          <Text
            style={[
              styles.netPositionText,
              netPosition >= 0 ? styles.positiveText : styles.negativeText,
            ]}
          >
            {formatSignedMoney(netPosition)}
          </Text>
          <Text style={styles.metricHelper}>Balance + incoming - outgoing</Text>
        </View>
      </View>

      <AppCard style={styles.sectionCard}>
        <View style={styles.cardHeadRow}>
          <View>
            <Text style={styles.cardEyebrow}>Top-ups</Text>
            <Text style={styles.cardTitle}>Recent wallet top-ups</Text>
          </View>

          <Pressable
            style={styles.smallPillButton}
            onPress={() => setTopUpsSheetOpen(true)}
          >
            <Text style={styles.smallPillButtonText}>History</Text>
          </Pressable>
        </View>

        {latestTopUps.length === 0 ? (
          <EmptyState
            title="No top-ups yet"
            message="After Razorpay top-up is connected, successful top-ups will appear here."
          />
        ) : (
          <View style={styles.list}>
            {latestTopUps.map((topUp) => (
              <View style={styles.transactionRow} key={topUp.id}>
                <View style={styles.transactionIcon}>
                  <Text style={styles.transactionIconText}>+</Text>
                </View>

                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {topUp.method || "Wallet top-up"}
                  </Text>
                  <Text style={styles.rowSubtext}>
                    {formatDate(topUp.displayDate || topUp.createdAt)}
                  </Text>
                </View>

                <AmountText amount={topUp.amount} size="sm" tone="success" />
              </View>
            ))}
          </View>
        )}
      </AppCard>

      <SheetModal
        visible={topUpSheetOpen}
        eyebrow="Wallet top-up"
        title="Add money"
        onClose={() => {
          setTopUpSheetOpen(false);
          setTopUpAmount("");
        }}
      >
        <View style={styles.topUpInfoCard}>
          <Text style={styles.cardEyebrow}>Available balance</Text>
          <Text style={styles.topUpBalance}>
            {formatMoney(availableBalance)}
          </Text>
          <Text style={styles.balanceHint}>
            Enter the amount you want to add to your SplitVerse wallet.
          </Text>
        </View>

        <AppTextInput
          label="Top-up amount"
          value={topUpAmount}
          onChangeText={setTopUpAmount}
          placeholder="500"
          keyboardType="decimal-pad"
          editable={!creatingTopUpOrder}
        />

        <View style={styles.quickAmountGrid}>
          {[100, 250, 500, 1000].map((amount) => (
            <Pressable
              key={amount}
              style={styles.quickAmountButton}
              onPress={() => setTopUpAmount(String(amount))}
              disabled={creatingTopUpOrder}
            >
              <Text style={styles.quickAmountText}>{formatMoney(amount)}</Text>
            </Pressable>
          ))}
        </View>

        <AppButton
          title={creatingTopUpOrder ? "Creating order" : "Continue to payment"}
          loading={creatingTopUpOrder}
          onPress={handleCreateTopUpOrder}
        />

        <Text style={styles.topUpNote}>
          Razorpay checkout will open after we move from Expo Go to a
          development build.
        </Text>
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.base,
    backgroundColor: colors.surfaceSoft,
  },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    ...typography.caption,
  },
  title: {
    color: colors.ink,
    ...typography.titleLg,
  },
  subtitle: {
    color: colors.body,
    ...typography.bodySm,
  },
  errorCard: {
    gap: spacing.sm,
    borderColor: colors.danger,
  },
  errorTitle: {
    color: colors.ink,
    ...typography.titleSm,
  },
  errorText: {
    color: colors.body,
    ...typography.bodySm,
  },
  balanceCard: {
    gap: spacing.base,
    backgroundColor: colors.canvas,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  balanceCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  cardEyebrow: {
    color: colors.body,
    ...typography.caption,
  },
  balanceAmount: {
    color: colors.ink,
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1,
  },
  balanceHint: {
    color: colors.body,
    ...typography.bodySm,
  },
  walletBadge: {
    minWidth: 54,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceStrong,
  },
  walletBadgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  healthPill: {
    borderRadius: radius.xl,
    padding: spacing.sm,
    backgroundColor: colors.surfaceSoft,
  },
  healthText: {
    ...typography.bodySm,
  },
  healthSuccess: {
    backgroundColor: colors.surfaceStrong,
  },
  healthDanger: {
    backgroundColor: colors.surfaceStrong,
  },
  healthWarning: {
    backgroundColor: colors.surfaceStrong,
  },
  healthSuccessText: {
    color: colors.success,
  },
  healthDangerText: {
    color: colors.danger,
  },
  healthWarningText: {
    color: colors.warning ?? colors.primary,
  },
  balanceActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  balanceActionButton: {
    flex: 1,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    width: "48%",
    minHeight: 124,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.canvas,
    padding: spacing.sm,
  },
  netMetricCard: {
    width: "100%",
  },
  metricLabel: {
    color: colors.body,
    ...typography.caption,
  },
  metricHelper: {
    color: colors.body,
    ...typography.caption,
  },
  netPositionText: {
    fontSize: 24,
    fontWeight: "800",
  },
  positiveText: {
    color: colors.success,
  },
  negativeText: {
    color: colors.danger,
  },
  sectionCard: {
    gap: spacing.base,
  },
  cardHeadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  cardTitle: {
    color: colors.ink,
    ...typography.titleMd,
  },
  smallPillButton: {
    minHeight: 38,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.base,
  },
  smallPillButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  countPill: {
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.ink,
    ...typography.caption,
  },
  list: {
    gap: spacing.sm,
  },
  transactionRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  settlementRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  transactionIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.canvas,
  },
  transactionIconText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    color: colors.ink,
    ...typography.titleSm,
  },
  rowSubtext: {
    color: colors.body,
    ...typography.bodySm,
  },
  sheetList: {
    gap: spacing.sm,
  },
  sheetRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  sheetSummaryGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  sheetSummaryBox: {
    flex: 1,
    minHeight: 96,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  topUpInfoCard: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.base,
  },
  topUpBalance: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  quickAmountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickAmountButton: {
    width: "48%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  quickAmountText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  topUpNote: {
    color: colors.body,
    ...typography.bodySm,
  },
});
