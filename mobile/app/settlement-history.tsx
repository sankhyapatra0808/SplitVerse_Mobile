import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import AmountText from "../src/components/AmountText";
import AppCard from "../src/components/AppCard";
import EmptyState from "../src/components/EmptyState";
import Screen from "../src/components/Screen";
import Text from "../src/components/LocalizedText";
import { useAppSettings } from "../src/context/useAppSettings";
import {
  getNetSettlementHistory,
  type NetSettlementHistoryEntry,
  type NetSettlementHistoryResponse,
} from "../src/lib/api";
import { showErrorAlert } from "../src/lib/errors";
import { radius, spacing, typography } from "../src/theme/tokens";

function formatHistoryDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function methodLabel(method: "wallet" | "manual" | "offset") {
  if (method === "wallet") return "Paid through wallet";
  if (method === "manual") return "Manually settled";
  return "Adjusted against";
}

export default function SettlementHistory() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    otherUserId?: string | string[];
    kind?: string | string[];
  }>();
  const otherUserId = Array.isArray(params.otherUserId)
    ? params.otherUserId[0]
    : params.otherUserId;
  const { formatCurrency, theme } = useAppSettings();
  const [history, setHistory] = useState<NetSettlementHistoryResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!otherUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getNetSettlementHistory(otherUserId);
      setHistory(response);
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not load settlement history",
        fallbackMessage: "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [otherUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.back();
        return true;
      },
    );

    return () => subscription.remove();
  }, [router]);

  const roomGroups = useMemo(() => {
    const groups = new Map<
      string,
      { roomId: string; roomName: string; entries: NetSettlementHistoryEntry[] }
    >();

    for (const entry of history?.entries ?? []) {
      const existing = groups.get(entry.roomId) ?? {
        roomId: entry.roomId,
        roomName: entry.roomName,
        entries: [],
      };
      existing.entries.push(entry);
      groups.set(entry.roomId, existing);
    }

    return Array.from(groups.values()).sort((left, right) => {
      const leftTime = Math.max(
        ...left.entries.map((entry) => new Date(entry.createdAt).getTime()),
      );
      const rightTime = Math.max(
        ...right.entries.map((entry) => new Date(entry.createdAt).getTime()),
      );
      return rightTime - leftTime;
    });
  }, [history]);

  const person = history?.person.name || history?.person.email || "Friend";

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
          accessibilityLabel="Back to settlement details"
          style={[styles.backButton, { backgroundColor: theme.surfaceStrong }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: theme.muted }]}>
            Full settlement history
          </Text>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {person}
          </Text>
        </View>
      </View>

      {history ? (
        <>
          <AppCard style={styles.summaryCard}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>
              All-time summary
            </Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryLabel, { color: theme.muted }]}>
                  Total payable
                </Text>
                <AmountText
                  amount={history.summary.lifetimePayable}
                  size="sm"
                  tone="danger"
                />
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryLabel, { color: theme.muted }]}>
                  Total receivable
                </Text>
                <AmountText
                  amount={history.summary.lifetimeReceivable}
                  size="sm"
                  tone="success"
                />
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryLabel, { color: theme.muted }]}>
                  Pending payable
                </Text>
                <AmountText
                  amount={history.summary.pendingPayable}
                  size="sm"
                  tone="danger"
                />
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryLabel, { color: theme.muted }]}>
                  Pending receivable
                </Text>
                <AmountText
                  amount={history.summary.pendingReceivable}
                  size="sm"
                  tone="success"
                />
              </View>
            </View>
            <Text style={[styles.helper, { color: theme.muted }]}>
              This includes every room item between you and {person}, including
              already settled items.
            </Text>
          </AppCard>

          {roomGroups.length === 0 ? (
            <EmptyState title="No settlement history" />
          ) : (
            roomGroups.map((group) => (
              <AppCard key={group.roomId} style={styles.roomCard}>
                <View style={styles.roomHeader}>
                  <View style={styles.roomHeaderCopy}>
                    <Text style={[styles.roomTitle, { color: theme.text }]}>
                      {group.roomName}
                    </Text>
                    <Text style={[styles.helper, { color: theme.muted }]}>
                      {group.entries.length} item
                      {group.entries.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemList}>
                  {group.entries.map((entry) => (
                    <View
                      key={entry.itemId}
                      style={[
                        styles.itemCard,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.surface,
                        },
                      ]}
                    >
                      <View style={styles.itemHeader}>
                        <View style={styles.itemHeaderCopy}>
                          <Text
                            style={[styles.itemTitle, { color: theme.text }]}
                          >
                            {entry.title}
                          </Text>
                          <Text style={[styles.helper, { color: theme.muted }]}>
                            {formatHistoryDate(entry.createdAt)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: theme.surfaceStrong,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              {
                                color:
                                  entry.direction === "payable"
                                    ? theme.danger
                                    : theme.success,
                              },
                            ]}
                          >
                            {entry.direction === "payable"
                              ? "Payable"
                              : "Receivable"}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[styles.directionText, { color: theme.muted }]}
                      >
                        {entry.debtorName || entry.debtorEmail} owes{" "}
                        {entry.creditorName || entry.creditorEmail}
                      </Text>

                      <View style={styles.amountRows}>
                        <View style={styles.amountRow}>
                          <Text
                            style={[styles.amountLabel, { color: theme.muted }]}
                          >
                            Original amount
                          </Text>
                          <Text
                            style={[styles.amountValue, { color: theme.text }]}
                          >
                            {formatCurrency(entry.originalAmount)}
                          </Text>
                        </View>
                        <View style={styles.amountRow}>
                          <Text
                            style={[styles.amountLabel, { color: theme.muted }]}
                          >
                            Settled
                          </Text>
                          <Text
                            style={[
                              styles.amountValue,
                              { color: theme.success },
                            ]}
                          >
                            {formatCurrency(entry.settledAmount)}
                          </Text>
                        </View>
                        <View style={styles.amountRow}>
                          <Text
                            style={[styles.amountLabel, { color: theme.muted }]}
                          >
                            Still pending
                          </Text>
                          <Text
                            style={[
                              styles.amountValue,
                              {
                                color:
                                  entry.pendingAmount > 0
                                    ? theme.danger
                                    : theme.success,
                              },
                            ]}
                          >
                            {formatCurrency(entry.pendingAmount)}
                          </Text>
                        </View>
                      </View>

                      {entry.settlements.length > 0 ? (
                        <View style={styles.eventList}>
                          <Text
                            style={[styles.eventHeading, { color: theme.text }]}
                          >
                            Settlement activity
                          </Text>
                          {entry.settlements.map((event) => (
                            <View
                              key={event.id}
                              style={[
                                styles.eventRow,
                                { backgroundColor: theme.surfaceStrong },
                              ]}
                            >
                              <View style={styles.eventCopy}>
                                <Text
                                  style={[
                                    styles.eventTitle,
                                    { color: theme.text },
                                  ]}
                                >
                                  {methodLabel(event.method)}
                                </Text>
                                {event.method === "offset" &&
                                event.counterItemTitle ? (
                                  <Text
                                    style={[
                                      styles.helper,
                                      { color: theme.muted },
                                    ]}
                                  >
                                    Deducted against {event.counterItemTitle}
                                    {event.counterRoomName
                                      ? ` · ${event.counterRoomName}`
                                      : ""}
                                  </Text>
                                ) : null}
                                <Text
                                  style={[
                                    styles.helper,
                                    { color: theme.muted },
                                  ]}
                                >
                                  {formatHistoryDate(event.createdAt)}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.eventAmount,
                                  { color: theme.success },
                                ]}
                              >
                                −{formatCurrency(event.amount)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={[styles.helper, { color: theme.muted }]}>
                          No settlement activity yet.
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </AppCard>
            ))
          )}
        </>
      ) : !loading ? (
        <EmptyState title="No settlement history" />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.base,
    padding: spacing.base,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...typography.caption },
  title: { ...typography.titleMd },
  summaryCard: { gap: spacing.sm },
  summaryTitle: { ...typography.titleMd },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryCell: { width: "47%", gap: 2 },
  summaryLabel: { ...typography.caption },
  helper: { ...typography.bodySm },
  roomCard: { gap: spacing.base },
  roomHeader: { flexDirection: "row", alignItems: "center" },
  roomHeaderCopy: { flex: 1 },
  roomTitle: { ...typography.titleMd },
  itemList: { gap: spacing.sm },
  itemCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  itemHeaderCopy: { flex: 1, minWidth: 0 },
  itemTitle: { ...typography.titleSm },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  badgeText: { ...typography.caption },
  directionText: { ...typography.bodySm },
  amountRows: { gap: spacing.xxs },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  amountLabel: { ...typography.bodySm },
  amountValue: { ...typography.bodySm, fontWeight: "700" },
  eventList: { gap: spacing.xs },
  eventHeading: { ...typography.caption },
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  eventCopy: { flex: 1, minWidth: 0 },
  eventTitle: { ...typography.bodySm, fontWeight: "600" },
  eventAmount: { ...typography.bodySm, fontWeight: "700" },
});
