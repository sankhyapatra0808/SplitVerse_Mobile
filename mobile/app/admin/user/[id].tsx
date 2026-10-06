import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import Screen from "../../../src/components/Screen";
import AppCard from "../../../src/components/AppCard";
import Text from "../../../src/components/LocalizedText";
import LoadingState from "../../../src/components/LoadingState";
import EmptyState from "../../../src/components/EmptyState";
import { useAppSettings } from "../../../src/context/useAppSettings";
import {
  getAdminUser,
  reverseAdminSettlement,
  updateAdminUserSecurityStatus,
} from "../../../src/lib/api";
import { radius, spacing, typography } from "../../../src/theme/tokens";

function date(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function money(value: unknown) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

type SecurityStatus = "active" | "restricted" | "blocked";
type PendingAction =
  | { type: "security"; status: SecurityStatus }
  | { type: "settlement"; settlement: any }
  | null;

export default function AdminUserDetail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { theme } = useAppSettings();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const next = await getAdminUser(id);
    setData(next);
  };

  useEffect(() => {
    load().catch((reasonValue) => setError(reasonValue instanceof Error ? reasonValue.message : "Failed to load user"));
  }, [id]);

  async function confirmAction() {
    if (!action || reason.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      if (action.type === "security") {
        await updateAdminUserSecurityStatus(id, action.status, reason.trim());
      } else {
        const mode = action.settlement.method === "wallet" ? "wallet_refund" : "external_refund";
        await reverseAdminSettlement(action.settlement.id, mode, reason.trim());
      }
      setAction(null);
      setReason("");
      await load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Administrative action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <LoadingState />;

  const status: SecurityStatus = data?.user?.account_status || "active";
  const actionTitle = action?.type === "security"
    ? action.status === "blocked" ? "Block account" : action.status === "restricted" ? "Restrict account" : "Restore account"
    : action?.settlement?.method === "wallet" ? "Refund and reverse settlement" : "Record external refund";
  const actionDescription = action?.type === "security"
    ? action.status === "blocked"
      ? "The account will lose normal API access. Known SplitVerse installations will be restricted so new accounts using them are placed into review."
      : action.status === "restricted"
        ? "The account stays readable, but protected write actions are denied while it is under review."
        : "Normal access is restored. Shared installations remain restricted if they are still tied to another blocked account."
    : action?.settlement?.method === "wallet"
      ? "The receiver's SplitVerse wallet is debited, the original payer is credited, and an audited reversal restores the outstanding balance."
      : "Use this only after the money has actually been returned outside SplitVerse. The original settlement remains visible.";

  return (
    <>
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
              <Text style={[styles.eyebrow, { color: theme.primary }]}>USER DETAILS</Text>
              <Text style={[styles.title, { color: theme.text }]}>{data.user.name || data.user.email}</Text>
              <Text style={[styles.body, { color: theme.body }]}>{data.user.email}</Text>
            </View>

            <AppCard style={styles.card}>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Profile</Text>
                <View style={[styles.statusPill, { backgroundColor: status === "blocked" ? `${theme.danger}16` : status === "restricted" ? `${theme.warning}16` : theme.primarySoft }]}>
                  <Text style={[styles.statusText, { color: status === "blocked" ? theme.danger : status === "restricted" ? theme.warning : theme.primary }]}>{humanize(status)}</Text>
                </View>
              </View>
              {[
                ["Name", data.user.name || "—"],
                ["Username", data.user.username ? `@${data.user.username}` : "—"],
                ["Email", data.user.email],
                ["Provider", data.user.provider || "—"],
                ["Account ID", data.user.id],
                ["Created", date(data.user.created_at)],
                ["Wallet PIN configured", data.user.has_wallet_pin ? "Yes" : "No"],
                ["Wallet PIN last changed", date(data.user.wallet_pin_updated_at)],
              ].map(([label, value], index, rows) => (
                <View key={String(label)} style={[styles.detailRow, index < rows.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
                  <Text style={[styles.detailLabel, { color: theme.body }]}>{String(label)}</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]} selectable>{String(value)}</Text>
                </View>
              ))}
            </AppCard>

            <AppCard style={styles.card}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Account control</Text>
              <Text style={[styles.body, { color: theme.body }]}>{data.user.security_reason || "No administrative restriction is currently recorded."}</Text>
              {data.user.security_updated_at ? <Text style={[styles.meta, { color: theme.muted }]}>Updated {date(data.user.security_updated_at)}{data.user.security_updated_by_email ? ` by ${data.user.security_updated_by_email}` : ""}</Text> : null}
              <View style={styles.actionRow}>
                {status === "active" ? <ActionButton label="Restrict" icon="shield-outline" tone="warning" theme={theme} onPress={() => { setReason(""); setAction({ type: "security", status: "restricted" }); }} /> : null}
                {status !== "blocked" ? <ActionButton label="Block" icon="ban-outline" tone="danger" theme={theme} onPress={() => { setReason(""); setAction({ type: "security", status: "blocked" }); }} /> : null}
                {status !== "active" ? <ActionButton label="Restore" icon="checkmark-circle-outline" tone="primary" theme={theme} onPress={() => { setReason(""); setAction({ type: "security", status: "active" }); }} /> : null}
              </View>
            </AppCard>

            <View style={styles.metrics}>
              {Object.entries(data.stats || {}).map(([key, value]) => (
                <AppCard key={key} style={styles.metric}>
                  <Text style={[styles.metricLabel, { color: theme.body }]}>{humanize(key)}</Text>
                  <Text style={[styles.metricValue, { color: theme.text }]}>{String(value)}</Text>
                </AppCard>
              ))}
              <AppCard style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.body }]}>Known Installations</Text>
                <Text style={[styles.metricValue, { color: theme.text }]}>{String(data.installations?.length || 0)}</Text>
              </AppCard>
            </View>

            <AppCard style={styles.card}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Known installations</Text>
              <Text style={[styles.body, { color: theme.body, marginBottom: spacing.sm }]}>Installation IDs are random and hashed server-side. They are used as a review signal, not proof of a person's identity.</Text>
              {data.installations?.length ? data.installations.map((installation: any, index: number) => (
                <View key={`${installation.platform}-${installation.first_seen_at}-${index}`} style={[styles.roomRow, index < data.installations.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
                  <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name="phone-portrait-outline" size={18} color={theme.primary} /></View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>{humanize(installation.platform || "unknown")}</Text>
                    <Text style={[styles.body, { color: theme.body }]}>Last seen {date(installation.last_seen_at)}</Text>
                  </View>
                  <Text style={[styles.meta, { color: installation.restricted ? theme.danger : theme.success }]}>{installation.restricted ? "Restricted" : "Normal"}</Text>
                </View>
              )) : <EmptyState title="No installation signal recorded" />}
            </AppCard>

            <AppCard style={styles.card}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent rooms</Text>
              {data.rooms?.length ? data.rooms.map((room: any, index: number) => (
                <Pressable
                  key={room.id}
                  style={[styles.roomRow, index < data.rooms.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}
                  onPress={() => router.push(`/admin/room/${room.id}` as never)}
                >
                  <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name="receipt-outline" size={18} color={theme.primary} /></View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>{room.name}</Text>
                    <Text style={[styles.body, { color: theme.body }]}>{humanize(room.role)} · {date(room.created_at)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                </Pressable>
              )) : <EmptyState title="No rooms found" />}
            </AppCard>

            <AppCard style={styles.card}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent settlement records</Text>
              <Text style={[styles.body, { color: theme.body, marginBottom: spacing.sm }]}>Reversals preserve the original record and create an audited compensating entry.</Text>
              {data.settlements?.length ? data.settlements.map((settlement: any, index: number) => (
                <View key={settlement.id} style={[styles.settlementRow, index < data.settlements.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>{settlement.payer_name || settlement.payer_email} → {settlement.receiver_name || settlement.receiver_email}</Text>
                    <Text style={[styles.body, { color: theme.body }]}>{money(settlement.amount)} · {settlement.room_name} · {humanize(settlement.method)}</Text>
                    <Text style={[styles.meta, { color: theme.muted }]}>{settlement.item_title} · {date(settlement.created_at)}</Text>
                  </View>
                  {settlement.reversal_id ? (
                    <Text style={[styles.meta, { color: theme.muted }]}>Reversed</Text>
                  ) : (
                    <Pressable style={[styles.reverseButton, { borderColor: theme.border, backgroundColor: theme.canvas }]} onPress={() => { setReason(""); setAction({ type: "settlement", settlement }); }}>
                      <Ionicons name="arrow-undo-outline" size={16} color={theme.primary} />
                      <Text style={[styles.reverseText, { color: theme.primary }]}>Reverse</Text>
                    </Pressable>
                  )}
                </View>
              )) : <EmptyState title="No reversible settlements" />}
            </AppCard>
          </>
        )}
      </Screen>

      <Modal visible={Boolean(action)} transparent animationType="fade" onRequestClose={() => { if (!busy) setAction(null); }}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>CONFIRMATION REQUIRED</Text>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{actionTitle}</Text>
            <Text style={[styles.body, { color: theme.body }]}>{actionDescription}</Text>
            {action?.type === "settlement" ? <Text style={[styles.context, { color: theme.text, backgroundColor: theme.surface }]}>{action.settlement.payer_name || action.settlement.payer_email} → {action.settlement.receiver_name || action.settlement.receiver_email} · {money(action.settlement.amount)}</Text> : null}
            <Text style={[styles.detailLabel, { color: theme.body }]}>Reason</Text>
            <TextInput
              multiline
              value={reason}
              onChangeText={setReason}
              placeholder="Explain why this administrative action is necessary"
              placeholderTextColor={theme.muted}
              style={[styles.reasonInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
            />
            <View style={styles.modalActions}>
              <Pressable disabled={busy} style={[styles.modalButton, { borderColor: theme.border }]} onPress={() => { setAction(null); setReason(""); }}><Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text></Pressable>
              <Pressable disabled={busy || reason.trim().length < (action?.type === "settlement" ? 5 : 3)} style={[styles.modalButton, { backgroundColor: action?.type === "security" && action.status === "blocked" ? theme.danger : theme.primary, opacity: busy || reason.trim().length < (action?.type === "settlement" ? 5 : 3) ? 0.45 : 1 }]} onPress={confirmAction}><Text style={[styles.modalButtonText, { color: "#fff" }]}>{busy ? "Applying…" : "Confirm"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ActionButton({ label, icon, tone, theme, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; tone: "primary" | "warning" | "danger"; theme: any; onPress: () => void }) {
  const color = tone === "danger" ? theme.danger : tone === "warning" ? theme.warning : theme.primary;
  return (
    <Pressable style={[styles.actionButton, { borderColor: `${color}55`, backgroundColor: `${color}10` }]} onPress={onPress}>
      <Ionicons name={icon} size={17} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.base },
  back: { width: 42, height: 42, borderWidth: 1, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  header: { gap: spacing.xs, marginBottom: spacing.xs },
  eyebrow: { ...typography.caption, letterSpacing: 0.6 },
  title: { ...typography.titleLg, fontWeight: "500" },
  body: { ...typography.bodySm },
  meta: { ...typography.caption },
  card: { gap: 0 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { ...typography.titleMd, marginBottom: spacing.sm },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill },
  statusText: { ...typography.caption, fontWeight: "600" },
  detailRow: { minHeight: 54, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.base, paddingVertical: spacing.sm },
  detailLabel: { ...typography.caption, flex: 0.8 },
  detailValue: { ...typography.bodySm, flex: 1.2, textAlign: "right" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { width: "48%", minHeight: 92, gap: spacing.xs, justifyContent: "space-between" },
  metricLabel: { ...typography.caption },
  metricValue: { ...typography.titleMd },
  roomRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  settlementRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  iconBox: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { ...typography.titleSm },
  error: { flexDirection: "row", gap: spacing.sm, borderWidth: 1 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.base },
  actionButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: spacing.base, borderWidth: 1, borderRadius: radius.pill },
  actionText: { ...typography.bodySm, fontWeight: "600" },
  reverseButton: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, borderWidth: 1, borderRadius: radius.pill },
  reverseText: { ...typography.caption, fontWeight: "600" },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: "rgba(0,0,0,0.44)" },
  modalCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  modalTitle: { ...typography.titleLg, fontWeight: "500" },
  context: { ...typography.bodySm, padding: spacing.sm, borderRadius: radius.md },
  reasonInput: { minHeight: 110, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, textAlignVertical: "top", ...typography.bodySm },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  modalButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.base },
  modalButtonText: { ...typography.bodySm, fontWeight: "600" },
});
