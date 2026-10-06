import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Screen from "../../../src/components/Screen";
import AppCard from "../../../src/components/AppCard";
import Text from "../../../src/components/LocalizedText";
import LoadingState from "../../../src/components/LoadingState";
import EmptyState from "../../../src/components/EmptyState";
import { useAppSettings } from "../../../src/context/useAppSettings";
import { getAdminRoom } from "../../../src/lib/api";
import { radius, spacing, typography } from "../../../src/theme/tokens";

function money(value: unknown) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function date(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminRoomDetail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { theme } = useAppSettings();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminRoom(id)
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load room"));
  }, [id]);

  const totals = useMemo(() => {
    if (!data) return { tracked: 0, pending: 0 };
    return data.items.reduce((result: { tracked: number; pending: number }, item: any) => ({
      tracked: result.tracked + Number(item.amount || 0),
      pending: result.pending + Number(item.pending_amount || 0),
    }), { tracked: 0, pending: 0 });
  }, [data]);

  if (!data && !error) return <LoadingState />;

  return (
    <Screen swipeTabs={false} contentStyle={styles.screen}>
      <Pressable style={[styles.back, { borderColor: theme.border, backgroundColor: theme.canvas }]} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={theme.text} />
      </Pressable>

      {error ? (
        <AppCard style={[styles.error, { borderColor: theme.danger }]}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
          <Text style={[styles.body, { color: theme.body }]}>{error}</Text>
        </AppCard>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>ROOM DETAIL</Text>
            <Text style={[styles.title, { color: theme.text }]}>{data.room.name}</Text>
            <Text style={[styles.body, { color: theme.body }]} selectable>{data.room.id}</Text>
          </View>

          <View style={styles.metrics}>
            <Metric label="Members" value={String(data.members.length)} theme={theme} />
            <Metric label="Items" value={String(data.items.length)} theme={theme} />
            <Metric label="Tracked" value={money(totals.tracked)} theme={theme} />
            <Metric label="Outstanding" value={money(totals.pending)} theme={theme} />
          </View>

          <AppCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Members</Text>
            {data.members.length ? data.members.map((member: any, index: number) => (
              <View key={member.id} style={[styles.listRow, index < data.members.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
                <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name="person-outline" size={18} color={theme.primary} /></View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{member.name || member.display_name || member.email}</Text>
                  <Text style={[styles.body, { color: theme.body }]}>{member.email}</Text>
                  <Text style={[styles.meta, { color: theme.muted }]}>{member.role} · {member.status}</Text>
                </View>
              </View>
            )) : <EmptyState title="No members found" />}
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Expense items</Text>
            {data.items.length ? data.items.map((item: any, index: number) => (
              <View key={item.id} style={[styles.itemCard, { borderColor: theme.borderSoft, backgroundColor: theme.surface }]}>
                <View style={styles.itemTop}>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.meta, { color: theme.muted }]}>{date(item.created_at)}</Text>
                  </View>
                  <Text style={[styles.itemAmount, { color: theme.text }]}>{money(item.amount)}</Text>
                </View>
                <Text style={[styles.body, { color: theme.body }]}>Paid by {item.paid_by_name || item.paid_by_email}</Text>
                <Text style={[styles.body, { color: theme.body }]}>Assigned to {item.assigned_to || item.assigned_email}</Text>
                <View style={styles.amountRow}>
                  <Text style={[styles.meta, { color: theme.muted }]}>Settled {money(item.settled_amount)}</Text>
                  <Text style={[styles.meta, { color: Number(item.pending_amount) > 0 ? theme.warning : theme.success }]}>Pending {money(item.pending_amount)}</Text>
                </View>
              </View>
            )) : <EmptyState title="No expense items" />}
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Settlement records</Text>
            {data.settlements?.length ? data.settlements.map((settlement: any, index: number) => (
              <View key={settlement.id} style={[styles.listRow, index < data.settlements.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
                <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name="checkmark-circle-outline" size={18} color={theme.primary} /></View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{settlement.method} · {money(settlement.amount)}</Text>
                  <Text style={[styles.meta, { color: theme.muted }]}>{date(settlement.created_at)}</Text>
                </View>
              </View>
            )) : <EmptyState title="No settlement records" />}
          </AppCard>
        </>
      )}
    </Screen>
  );
}

function Metric({ label, value, theme }: { label: string; value: string; theme: any }) {
  return <AppCard style={styles.metric}><Text style={[styles.metricLabel, { color: theme.body }]}>{label}</Text><Text style={[styles.metricValue, { color: theme.text }]} numberOfLines={2}>{value}</Text></AppCard>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.base },
  back: { width: 42, height: 42, borderWidth: 1, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  header: { gap: spacing.xs, marginBottom: spacing.xs },
  eyebrow: { ...typography.caption, letterSpacing: 0.6 },
  title: { ...typography.titleLg, fontWeight: "500" },
  body: { ...typography.bodySm },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { width: "48%", minHeight: 92, gap: spacing.xs, justifyContent: "space-between" },
  metricLabel: { ...typography.caption },
  metricValue: { ...typography.titleMd },
  card: { gap: spacing.sm },
  sectionTitle: { ...typography.titleMd },
  listRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  iconBox: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { ...typography.titleSm },
  meta: { ...typography.caption, fontSize: 10, lineHeight: 15, fontWeight: "500" },
  itemCard: { gap: 6, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  itemTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  itemAmount: { ...typography.titleSm },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: 2 },
  error: { flexDirection: "row", gap: spacing.sm, borderWidth: 1 },
});
