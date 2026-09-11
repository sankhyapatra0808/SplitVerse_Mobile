import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import AmountText from "../../src/components/AmountText";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import EmptyState from "../../src/components/EmptyState";
import Screen from "../../src/components/Screen";
import SheetModal from "../../src/components/SheetModal";
import Text from "../../src/components/LocalizedText";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import {
  getNetSettlements,
  payNetSettlement,
  type NetSettlement,
} from "../../src/lib/api";
import { showErrorAlert } from "../../src/lib/errors";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

export default function SettlementDetails() {
  const router = useRouter();
  const { dbUser } = useAuth();
  const { kind } = useLocalSearchParams<{ kind?: string | string[] }>();
  const { formatCurrency, theme } = useAppSettings();
  const direction = (Array.isArray(kind) ? kind[0] : kind) === "receivable"
    ? "receivable"
    : "payable";
  const [settlements, setSettlements] = useState<NetSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentTarget, setPaymentTarget] = useState<NetSettlement | null>(null);
  const [walletPin, setWalletPin] = useState("");
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getNetSettlements();
      setSettlements(
        response.settlements.filter((settlement) =>
          direction === "payable" ? settlement.isOutgoing : settlement.isIncoming,
        ),
      );
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not load settlement details",
        fallbackMessage: "Pull down to try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [direction]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(
    () => settlements.reduce((sum, settlement) => sum + settlement.amount, 0),
    [settlements],
  );

  async function handlePay() {
    if (!paymentTarget || !/^\d{4,6}$/.test(walletPin.trim())) {
      Alert.alert("Wallet PIN required", "Enter your 4 to 6 digit wallet PIN.");
      return;
    }

    try {
      setPaying(true);
      await payNetSettlement({
        toUserId: paymentTarget.toUserId,
        walletPin: walletPin.trim(),
      });
      setPaymentTarget(null);
      setWalletPin("");
      await load();
      Alert.alert("Payment complete", "The adjusted settlement was paid successfully.");
    } catch (error) {
      showErrorAlert(error, {
        title: "Payment failed",
        fallbackMessage: "The adjusted settlement could not be paid.",
      });
    } finally {
      setPaying(false);
    }
  }

  return (
    <Screen
      refreshing={loading}
      onRefresh={load}
      safeBackgroundColor={theme.background}
      contentStyle={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to rooms"
          style={[styles.backButton, { backgroundColor: theme.surfaceStrong }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Adjusted settlements</Text>
          <Text style={styles.title}>
            {direction === "payable" ? "Payable details" : "Receivable details"}
          </Text>
        </View>
      </View>

      <AppCard style={styles.totalCard}>
        <Text style={styles.label}>Final {direction}</Text>
        <AmountText
          amount={total}
          size="lg"
          tone={direction === "payable" ? "danger" : "success"}
        />
        <Text style={styles.helper}>
          Opposite dues are deducted first. Every contributing room item is shown below.
        </Text>
      </AppCard>

      {settlements.length === 0 ? (
        <EmptyState title={`No ${direction} settlements`} />
      ) : (
        settlements.map((settlement) => {
          const person = direction === "payable"
            ? settlement.toName || settlement.toEmail
            : settlement.fromName || settlement.fromEmail;

          return (
            <AppCard key={`${settlement.fromUserId}-${settlement.toUserId}`} style={styles.personCard}>
              <View style={styles.personHeader}>
                <View style={styles.personCopy}>
                  <Text style={styles.personName}>{person}</Text>
                  <Text style={styles.helper}>
                    {settlement.breakdown.length} room item
                    {settlement.breakdown.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <AmountText
                  amount={settlement.amount}
                  size="md"
                  tone={direction === "payable" ? "danger" : "success"}
                />
              </View>

              <View style={styles.breakdownList}>
                {settlement.breakdown.map((line) => {
                  const addsToFinal = direction === "payable"
                    ? line.debtorUserId === dbUser?.id
                    : line.creditorUserId === dbUser?.id;

                  return (
                    <View
                      key={`${line.itemId}-${line.direction}`}
                      style={[
                        styles.breakdownRow,
                        { borderColor: theme.border, backgroundColor: theme.surface },
                      ]}
                    >
                      <View style={styles.breakdownCopy}>
                        <Text style={styles.itemTitle}>{line.title}</Text>
                        <Text style={styles.helper}>{line.roomName}</Text>
                        <Text style={styles.direction}>{line.direction}</Text>
                        {line.settledAmount > 0 ? (
                          <Text style={styles.helper}>
                            Original {formatCurrency(line.originalAmount)} · settled {formatCurrency(line.settledAmount)}
                          </Text>
                        ) : null}
                        {(line.offsetAdjustments ?? []).map((adjustment) => (
                          <View
                            key={`${line.itemId}-${adjustment.itemId}`}
                            style={[
                              styles.offsetRow,
                              { backgroundColor: theme.surfaceStrong },
                            ]}
                          >
                            <View style={styles.offsetCopy}>
                              <Text style={styles.offsetTitle} numberOfLines={1}>
                                Deducted against {adjustment.title}
                              </Text>
                              <Text style={styles.helper} numberOfLines={1}>
                                {adjustment.roomName}
                              </Text>
                            </View>
                            <Text style={[styles.offsetAmount, { color: theme.success }]}>
                              −{formatCurrency(adjustment.amount)}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <View style={styles.lineAmount}>
                        <Text
                          style={[
                            styles.sign,
                            { color: addsToFinal ? theme.danger : theme.success },
                          ]}
                        >
                          {addsToFinal ? "+" : "−"}
                        </Text>
                        <AmountText amount={line.amount} size="sm" />
                        <Text style={styles.effectLabel}>
                          {addsToFinal ? "added" : "deducted"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.formulaRow, { backgroundColor: theme.surfaceStrong }]}>
                <Text style={styles.formulaLabel}>Final after adjustment</Text>
                <AmountText
                  amount={settlement.amount}
                  size="sm"
                  tone={direction === "payable" ? "danger" : "success"}
                />
              </View>

              {direction === "payable" ? (
                <AppButton title="Pay net amount" onPress={() => setPaymentTarget(settlement)} />
              ) : null}
            </AppCard>
          );
        })
      )}

      <SheetModal
        visible={Boolean(paymentTarget)}
        eyebrow="Wallet payment"
        title="Pay adjusted amount"
        onClose={() => {
          if (paying) return;
          setPaymentTarget(null);
          setWalletPin("");
        }}
      >
        {paymentTarget ? (
          <>
            <Text style={styles.helper}>
              Pay {paymentTarget.toName || paymentTarget.toEmail}
            </Text>
            <AmountText amount={paymentTarget.amount} size="lg" tone="danger" />
            <AppTextInput
              label="Wallet PIN"
              value={walletPin}
              onChangeText={setWalletPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              editable={!paying}
            />
            <AppButton
              title={paying ? "Paying" : "Confirm payment"}
              loading={paying}
              onPress={handlePay}
            />
          </>
        ) : null}
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.base, padding: spacing.base, paddingBottom: spacing.xxl + 80 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.body, ...typography.caption },
  title: { color: colors.ink, ...typography.titleLg },
  totalCard: { gap: spacing.xs },
  label: { color: colors.body, ...typography.caption },
  helper: { color: colors.body, ...typography.bodySm },
  personCard: { gap: spacing.base },
  personHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { color: colors.ink, ...typography.titleMd },
  breakdownList: { gap: spacing.sm },
  breakdownRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm },
  breakdownCopy: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { color: colors.ink, ...typography.titleSm },
  direction: { color: colors.body, ...typography.caption },
  lineAmount: { alignItems: "flex-end", minWidth: 78 },
  sign: { fontSize: 18, fontWeight: "800" },
  effectLabel: { color: colors.body, ...typography.caption },
  offsetRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs, borderRadius: radius.md, padding: spacing.xs },
  offsetCopy: { flex: 1, minWidth: 0 },
  offsetTitle: { color: colors.ink, ...typography.caption },
  offsetAmount: { fontSize: 12, fontWeight: "800" },
  formulaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm },
  formulaLabel: { flex: 1, color: colors.ink, ...typography.bodySm },
});
