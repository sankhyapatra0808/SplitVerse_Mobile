import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import AmountText from "../../src/components/AmountText";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import EmptyState from "../../src/components/EmptyState";
import { WalletSkeleton } from "../../src/components/PageSkeletons";
import Screen from "../../src/components/Screen";
import SheetModal from "../../src/components/SheetModal";
import AppTextInput from "../../src/components/AppTextInput";
import Text from "../../src/components/LocalizedText";
import {
  getRecentWalletTopUps,
  getWalletSummary,
  createRazorpayWalletOrder,
  verifyRazorpayWalletPayment,
  type WalletSummaryResponse,
  type WalletTopUpItem,
} from "../../src/lib/api";
import { showErrorAlert } from "../../src/lib/errors";
import { useRefreshOnReturn } from "../../src/hooks/useRefreshOnReturn";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import { HERO_BLUR_RADIUS } from "../../src/theme/performance";
import RazorpayCheckout from "react-native-razorpay";
import { useAppSettings } from "../../src/context/useAppSettings";
import { useAuth } from "../../src/context/AuthContext";
import Ionicons from "@expo/vector-icons/build/Ionicons";

let walletCache: {
  walletData: WalletSummaryResponse | null;
  topUps: WalletTopUpItem[];
} | null = null;

export default function Wallet() {
  const { user, dbUser } = useAuth();
  const {
    avatarId,
    appCurrency,
    formatCurrency,
    formatDate: formatLiveDate,
    theme,
  } = useAppSettings();
  const [walletData, setWalletData] = useState<WalletSummaryResponse | null>(
    walletCache?.walletData ?? null,
  );
  const [topUps, setTopUps] = useState<WalletTopUpItem[]>(
    walletCache?.topUps ?? [],
  );

  const [loading, setLoading] = useState(!walletCache);
  const [refreshingSilent, setRefreshingSilent] = useState(false);
  const [topUpsSheetOpen, setTopUpsSheetOpen] = useState(false);

  const photoUrl =
    avatarId === "initials"
      ? undefined
      : dbUser?.display_photo_url ||
        dbUser?.profile_photo_url ||
        dbUser?.photo_url ||
        user?.photoURL ||
        undefined;

  const summary = walletData?.summary;

  const availableBalance = summary?.availableBalance ?? 0;
  const pendingIncoming = summary?.pendingIncoming ?? 0;
  const pendingOutgoing = summary?.pendingOutgoing ?? 0;
  const netPosition = summary?.netPosition ?? 0;

  const [topUpSheetOpen, setTopUpSheetOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [creatingTopUpOrder, setCreatingTopUpOrder] = useState(false);
  const [topUpError, setTopUpError] = useState("");

  const latestTopUps = topUps.slice(0, 5);

  const walletHealthText = useMemo(() => {
    if (availableBalance <= 0 && pendingOutgoing > 0) {
      return "Low balance. Add money before paying dues.";
    }

    if (netPosition >= 0) {
      return "Wallet in a Healthy position.";
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
      if (!silent && !walletCache) {
        setLoading(true);
      } else {
        setRefreshingSilent(true);
      }

      const [walletResponse, topUpsResponse] = await Promise.all([
        getWalletSummary(),
        getRecentWalletTopUps(),
      ]);

      walletCache = {
        walletData: walletResponse,
        topUps: topUpsResponse.topUps ?? [],
      };
      setWalletData(walletResponse);
      setTopUps(topUpsResponse.topUps ?? []);
    } catch (loadError) {
      if (!silent) {
        showErrorAlert(loadError, {
          title: "Could not refresh wallet",
          fallbackMessage:
            "Your wallet balance and activity could not be loaded. Pull down to try again.",
        });
      }
    } finally {
      setLoading(false);
      setRefreshingSilent(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet(Boolean(walletCache));
  }, [loadWallet]);

  useRefreshOnReturn(
    useCallback(() => {
      void loadWallet(true);
    }, [loadWallet]),
  );

  function handleTopUpPress() {
    setTopUpAmount("");
    setTopUpError("");
    setTopUpSheetOpen(true);
  }

  async function handleCreateTopUpOrder() {
    const amount = Number(topUpAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setTopUpError("Enter a valid top-up amount.");
      return;
    }

    if (amount < 10) {
      setTopUpError("Minimum wallet top-up amount is ₹10.");
      return;
    }

    setTopUpError("");

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
          color: theme.primary,
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
    } catch {
      Alert.alert("Payment failed", "Adding money to wallet failed.");
    } finally {
      setCreatingTopUpOrder(false);
    }
  }

  if (loading && !walletData) {
    return (
      <Screen scroll={false} safeBackgroundColor={theme.background}>
        <WalletSkeleton />
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={loading || refreshingSilent}
      onRefresh={() => loadWallet()}
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
      <View style={styles.heroClip}>
        {photoUrl ? (
          <ImageBackground
            source={{ uri: photoUrl }}
            blurRadius={HERO_BLUR_RADIUS}
            style={styles.heroImage}
            imageStyle={styles.heroImageInner}
          >
            <LinearGradient
              colors={
                theme.mode === "dark"
                  ? ["rgba(0,0,0,0.30)", "rgba(0, 0, 0, 0.86)"]
                  : ["rgba(8, 8, 8, 0.18)", "rgb(255, 255, 255)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.heroOverlay}
            >
              <View style={styles.heroTitle}>
                <Text style={styles.heroTitle}>Wallet & Balance</Text>
                <Text style={styles.heroSubtitle}>
                  Balance, dues, top-ups, and activity.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Wallet working info"
                hitSlop={10}
                style={({ pressed }) => [
                  styles.walletBalanceInfoButton,
                  {
                    backgroundColor: theme.surfaceStrong,
                    opacity: pressed ? 0.68 : 1,
                  },
                ]}
                onPress={() =>
                  Alert.alert(
                    "How adjusted wallet works",
                    "View your available balance, pending dues, wallet top-ups, and recent wallet transactions in one place.",
                  )
                }
              >
                <Ionicons
                  name="information-circle-outline"
                  size={21}
                  color={theme.primary}
                />
              </Pressable>
            </LinearGradient>
          </ImageBackground>
        ) : (
          <LinearGradient
            colors={
              theme.mode === "dark"
                ? ["#111318", "#050608"]
                : [theme.surfaceStrong, theme.card]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroOverlay}
          >
            <View style={styles.heroTitle}>
                <Text style={styles.heroTitle}>Wallet & Balance</Text>
                <Text style={styles.heroSubtitle}>
                  Balance, dues, top-ups, and activity.
                </Text>
              </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wallet working info"
              hitSlop={10}
              style={({ pressed }) => [
                styles.walletBalanceInfoButton,
                {
                  backgroundColor: theme.surfaceStrong,
                  opacity: pressed ? 0.68 : 1,
                },
              ]}
              onPress={() =>
                Alert.alert(
                  "How adjusted wallet works",
                  "View your available balance, pending dues, wallet top-ups, and recent wallet transactions in one place.",
                )
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={21}
                color={theme.primary}
              />
            </Pressable>
          </LinearGradient>
        )}
      </View>

      <AppCard style={[styles.balanceCard, { backgroundColor: theme.card }]}>
        <View style={styles.balanceHeader}>
          <View style={styles.balanceCopy}>
            <Text style={styles.cardEyebrow}>Available balance</Text>
            <Text style={styles.balanceAmount}>
              {formatCurrency(availableBalance)}
            </Text>
          </View>

          <View
            style={[
              styles.walletBadge,
              { backgroundColor: theme.surfaceStrong },
            ]}
          >
            <Text style={styles.walletBadgeText}>{appCurrency}</Text>
          </View>
        </View>

        <View
          style={[
            styles.healthPill,
            walletHealthTone === "success" && styles.healthSuccess,
            walletHealthTone === "danger" && styles.healthDanger,
            walletHealthTone === "warning" && styles.healthWarning,
            {
              backgroundColor: theme.mode === "dark" ? "#050608" : "#ffffff",
              borderColor:
                theme.mode === "dark"
                  ? "rgba(255,255,255,0.10)"
                  : "rgba(15,23,42,0.08)",
            },
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
        <View
          style={[
            styles.metricCard,
            { borderColor: theme.border, backgroundColor: theme.card },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
            <Text style={styles.metricLabel}>Pending incoming</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pending incoming"
              hitSlop={10}
              style={({ pressed }) => [
                styles.pendingInfoButton,
                {
                  backgroundColor: theme.surfaceStrong,
                  opacity: pressed ? 0.68 : 1,
                },
              ]}
              onPress={() =>
                Alert.alert(
                  "Pending incoming: ",
                  "This is the amount that others owe you.",
                )
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={21}
                color={theme.primary}
              />
            </Pressable>
          </View>
          <AmountText
            amount={pendingIncoming}
            style={{ letterSpacing: 1.2 }}
            size="md"
            tone="success"
          />
        </View>

        <View
          style={[
            styles.metricCard,
            { borderColor: theme.border, backgroundColor: theme.card },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
            <Text style={styles.metricLabel}>Pending outgoing</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pending outgoing"
              hitSlop={10}
              style={({ pressed }) => [
                styles.pendingInfoButton,
                {
                  backgroundColor: theme.surfaceStrong,
                  opacity: pressed ? 0.68 : 1,
                },
              ]}
              onPress={() =>
                Alert.alert(
                  "Pending outgoing: ",
                  "This is the amount that you need to pay.",
                )
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={21}
                color={theme.primary}
              />
            </Pressable>
          </View>
          <AmountText
            amount={pendingOutgoing}
            style={{ letterSpacing: 1.2 }}
            size="md"
            tone={pendingOutgoing > 0 ? "danger" : "success"}
          />
        </View>

        <View
          style={[
            styles.metricCard,
            styles.netMetricCard,
            { borderColor: theme.border, backgroundColor: theme.card },
          ]}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 230 }}
          >
            <Text style={styles.metricLabel}>Net position</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Net position"
              hitSlop={10}
              style={({ pressed }) => [
                styles.pendingInfoButton,
                {
                  backgroundColor: theme.surfaceStrong,
                  opacity: pressed ? 0.68 : 1,
                },
              ]}
              onPress={() =>
                Alert.alert(
                  "Net position: ",
                  "This is your overall financial position i.e. Balance + incoming - outgoing.",
                )
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={21}
                color={theme.primary}
              />
            </Pressable>
          </View>
          <Text
            style={[
              styles.netPositionText,
              netPosition >= 0 ? styles.positiveText : styles.negativeText,
            ]}
          >
            {formatCurrency(netPosition, { signed: true })}
          </Text>
        </View>
      </View>

      <AppCard style={styles.sectionCard}>
        <View style={styles.cardHeadRow}>
          <View>
            <Text style={styles.cardEyebrow}>Top-ups</Text>
            <Text style={styles.cardTitle}>Recent wallet top-ups</Text>
          </View>

          <Pressable
            style={[
              styles.smallPillButton,
              { backgroundColor: theme.surfaceStrong },
            ]}
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
              <View
                style={[
                  styles.transactionRow,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                ]}
                key={topUp.id}
              >
                <View
                  style={[
                    styles.transactionIcon,
                    { backgroundColor: theme.surfaceStrong },
                  ]}
                >
                  <Text style={styles.transactionIconText}>+</Text>
                </View>

                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {topUp.method || "Wallet top-up"}
                  </Text>
                  <Text style={styles.rowSubtext}>
                    {formatLiveDate(topUp.createdAt || topUp.displayDate)}
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
          setTopUpError("");
        }}
      >
        <View
          style={[
            styles.topUpInfoCard,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}
        >
          <Text style={styles.cardEyebrow}>Available balance</Text>
          <Text style={styles.topUpBalance}>
            {formatCurrency(availableBalance)}
          </Text>
          <Text style={styles.balanceHint}>
            Enter the amount you want to add to your SplitVerse wallet.
          </Text>
        </View>

        <AppTextInput
          label="Top-up amount"
          value={topUpAmount}
          onChangeText={(value) => {
            setTopUpAmount(value);
            if (topUpError) setTopUpError("");
          }}
          placeholder="500"
          keyboardType="decimal-pad"
          editable={!creatingTopUpOrder}
        />

        {topUpError ? (
          <View
            style={[
              styles.inlineError,
              {
                borderColor: theme.danger,
                backgroundColor:
                  theme.mode === "dark"
                    ? "rgba(255,104,117,0.10)"
                    : "rgba(207,32,47,0.08)",
              },
            ]}
          >
            <Text style={[styles.inlineErrorText, { color: theme.danger }]}>
              {topUpError}
            </Text>
          </View>
        ) : null}

        <View style={styles.quickAmountGrid}>
          {[100, 250, 500, 1000].map((amount) => (
            <Pressable
              key={amount}
              style={[
                styles.quickAmountButton,
                { borderColor: theme.border, backgroundColor: theme.surface },
              ]}
              onPress={() => {
                setTopUpAmount(String(amount));
                setTopUpError("");
              }}
              disabled={creatingTopUpOrder}
            >
              <Text style={styles.quickAmountText}>
                {formatCurrency(amount)}
              </Text>
            </Pressable>
          ))}
        </View>

        <AppButton
          style={[
            styles.proceedAmountButton,
            { borderColor: theme.primary, backgroundColor: theme.primary },
          ]}
          title={creatingTopUpOrder ? "Creating order" : "Continue to payment"}
          loading={creatingTopUpOrder}
          onPress={handleCreateTopUpOrder}
        />
      </SheetModal>

      <SheetModal
        visible={topUpsSheetOpen}
        eyebrow="Top-up history"
        title="Wallet top-up history"
        onClose={() => setTopUpsSheetOpen(false)}
      >
        {topUps.length === 0 ? (
          <EmptyState title="No top-ups yet" />
        ) : (
          <View style={styles.sheetList}>
            {topUps.map((topUp) => (
              <View
                style={[
                  styles.sheetRow,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                ]}
                key={topUp.id}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>
                    {topUp.method || "Wallet top-up"}
                  </Text>
                  <Text style={styles.rowSubtext}>
                    {formatLiveDate(topUp.createdAt || topUp.displayDate)}
                  </Text>
                </View>
                <AmountText amount={topUp.amount} size="sm" tone="success" />
              </View>
            ))}
          </View>
        )}
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.base,
    padding: 0,
    paddingBottom: spacing.xxl + 160,
    backgroundColor: colors.surfaceSoft,
  },
  heroClip: {
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroImage: {
    minHeight: 190,
  },
  heroImageInner: {
    opacity: 0.96,
  },
  heroOverlay: {
    minHeight: 190,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    flexDirection: "row",
  },
  heroTitle: {
    marginTop: spacing.xs,
    color: colors.onPrimary,
    ...typography.titleLg,
    lineHeight: 42,
    paddingBottom: 3,
    includeFontPadding: true,
    flex: 1,
    minWidth: 0,
  },
  heroSubtitle: {
    maxWidth: 320,
    marginTop: spacing.sm,
    color: "rgba(255,255,255,0.82)",
    ...typography.bodySm,
  },
  walletBalanceInfoButton: {
    width: 35,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    flexShrink: 0,
    marginTop: 1.2 * spacing.sm,
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
  balanceCard: {
    gap: spacing.base,
    marginHorizontal: spacing.base,
    marginTop: -spacing.lg,
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
    letterSpacing: 1.5,
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
    borderWidth: 1,
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
    paddingHorizontal: spacing.base,
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    width: "48%",
    minHeight: 90,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.canvas,
    padding: spacing.sm,
  },
  netMetricCard: {
    width: "100%",
    minHeight: 90,
  },
  metricLabel: {
    color: colors.body,
    ...typography.caption,
  },
  pendingInfoButton: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  metricHelper: {
    color: colors.body,
    ...typography.caption,
  },
  netPositionText: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  positiveText: {
    color: colors.success,
  },
  negativeText: {
    color: colors.danger,
  },
  sectionCard: {
    gap: spacing.base,
    marginHorizontal: spacing.base,
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
    letterSpacing: 1.2,
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
  proceedAmountButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  topUpNote: {
    color: colors.body,
    ...typography.bodySm,
  },
  inlineError: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  inlineErrorText: {
    ...typography.bodySm,
    fontWeight: "700",
  },
});
