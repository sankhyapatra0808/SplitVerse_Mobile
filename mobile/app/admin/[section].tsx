import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Screen from "../../src/components/Screen";
import AppCard from "../../src/components/AppCard";
import Text from "../../src/components/LocalizedText";
import LoadingState from "../../src/components/LoadingState";
import EmptyState from "../../src/components/EmptyState";
import DropdownSelect from "../../src/components/DropdownSelect";
import AppButton from "../../src/components/AppButton";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import { resolveAdminAccess } from "../../src/lib/adminAccess";
import {
  getAdminAnalytics,
  getAdminAudit,
  getAdminAuditLogs,
  getAdminConfig,
  getAdminFeatureFlags,
  getAdminFinancialActivity,
  getAdminOverview,
  getAdminRooms,
  getAdminSecurity,
  getAdminSettlementDebugger,
  getAdminUsers,
} from "../../src/lib/api";
import { radius, spacing, typography } from "../../src/theme/tokens";

const titles: Record<string, string> = {
  overview: "Overview",
  users: "Users",
  rooms: "Rooms",
  settlements: "Settlement Debugger",
  financial: "Financial Activity",
  audit: "Audit & Integrity",
  analytics: "Analytics",
  flags: "Feature Flags",
  versions: "App Versions",
  config: "Configuration",
  security: "Security",
  logs: "Admin Audit Logs",
};

const subtitles: Record<string, string> = {
  overview: "Operational metrics and a guide to the SplitVerse control center.",
  users: "Account activity without exposing protected credentials.",
  rooms: "Room membership, tracked value, and outstanding balances.",
  settlements: "Trace balances using the canonical SplitVerse settlement service.",
  financial: "Recorded expense, settlement, and wallet activity.",
  audit: "Traceable administrator actions and integrity events.",
  analytics: "Real 30-day aggregates with no synthetic growth values.",
  flags: "Server-controlled product flags currently stored by SplitVerse.",
  versions: "Android update and minimum-version configuration.",
  config: "Runtime-safe application settings; secrets stay server-side.",
  security: "Account restrictions, installation-risk signals, and audited security actions.",
  logs: "Append-only administrator mutation history.",
};

function money(value: unknown) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function date(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  return String(value);
}

export default function AdminSection() {
  const { section = "overview" } = useLocalSearchParams<{ section: string }>();
  const { user } = useAuth();
  const { theme } = useAppSettings();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [roomId, setRoomId] = useState("");
  const [userId, setUserId] = useState("");
  const [rooms, setRooms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tracing, setTracing] = useState(false);

  useEffect(() => {
    resolveAdminAccess(user?.email)
      .then((value) => {
        setAllowed(value);
        if (!value) router.replace("/(tabs)/settings");
      })
      .catch(() => router.replace("/(tabs)/settings"));
  }, [user?.email]);

  useEffect(() => {
    if (allowed !== true) return;
    setData(null);
    setError("");

    const load = async () => {
      if (section === "users") return getAdminUsers();
      if (section === "rooms") return getAdminRooms();
      if (section === "settlements") {
        const [roomData, userData] = await Promise.all([getAdminRooms(), getAdminUsers()]);
        setRooms(roomData.rooms);
        setUsers(userData.users);
        return { ready: true };
      }
      if (section === "overview") return getAdminOverview();
      if (section === "financial") return getAdminFinancialActivity();
      if (section === "audit") return getAdminAudit();
      if (section === "analytics") return getAdminAnalytics();
      if (section === "flags") return getAdminFeatureFlags();
      if (section === "versions" || section === "config") return getAdminConfig();
      if (section === "security") return getAdminSecurity();
      if (section === "logs") return getAdminAuditLogs();
      return null;
    };

    load()
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load admin data"));
  }, [allowed, section]);

  if (allowed !== true) return <LoadingState />;

  async function trace() {
    if (!roomId || !userId) return;
    setTracing(true);
    setError("");
    try {
      setData(await getAdminSettlementDebugger(roomId, userId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to trace settlement");
    } finally {
      setTracing(false);
    }
  }

  const title = titles[section] || "Admin";

  return (
    <Screen swipeTabs={false} contentStyle={styles.screen}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.back, { borderColor: theme.border, backgroundColor: theme.canvas }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>SPLITVERSE ADMIN</Text>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.body }]}>{subtitles[section] || "Secure administrative workspace."}</Text>
      </View>

      {error ? (
        <AppCard style={[styles.errorCard, { borderColor: theme.danger }]}> 
          <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
          <View style={styles.errorCopy}>
            <Text style={[styles.errorTitle, { color: theme.text }]}>Couldn’t load this view</Text>
            <Text style={[styles.itemSub, { color: theme.body }]}>{error}</Text>
          </View>
        </AppCard>
      ) : null}

      {section === "settlements" ? (
        <AppCard style={styles.card}>
          <SectionLabel title="Build a trace" description="Choose a room and user. This diagnostic action does not change balances." theme={theme} />
          <DropdownSelect label="Room" value={roomId} options={rooms.map((room) => ({ label: room.name, value: room.id }))} onChange={setRoomId} />
          <DropdownSelect label="User" value={userId} options={users.map((entry) => ({ label: entry.name || entry.email, value: entry.id, helper: entry.email }))} onChange={setUserId} />
          <AppButton title={tracing ? "Tracing…" : "Trace calculation"} disabled={!roomId || !userId || tracing} onPress={trace} />
        </AppCard>
      ) : null}

      {!data ? <LoadingState /> : <Content section={section} data={data} theme={theme} />}
    </Screen>
  );
}

function SectionLabel({ title, description, theme }: { title: string; description?: string; theme: any }) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {description ? <Text style={[styles.itemSub, { color: theme.body }]}>{description}</Text> : null}
    </View>
  );
}

function StatusPill({ label, tone = "neutral", theme }: { label: string; tone?: "neutral" | "good" | "warning" | "primary"; theme: any }) {
  const color = tone === "good" ? theme.success : tone === "warning" ? theme.warning : tone === "primary" ? theme.primary : theme.body;
  const background = tone === "primary" ? theme.primarySoft : theme.surface;
  return <View style={[styles.statusPill, { borderColor: theme.borderSoft, backgroundColor: background }]}><Text style={[styles.statusText, { color }]}>{label}</Text></View>;
}

function Metric({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <AppCard style={styles.metric}>
      <Text style={[styles.metricLabel, { color: theme.body }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.text }]} numberOfLines={2}>{value}</Text>
    </AppCard>
  );
}

function Content({ section, data, theme }: { section: string; data: any; theme: any }) {
  if (section === "users") {
    return (
      <AppCard style={styles.card}>
        <SectionLabel title="Accounts" description={`${data.total ?? data.users?.length ?? 0} users returned`} theme={theme} />
        {data.users?.length ? data.users.map((entry: any, index: number) => (
          <Pressable
            key={entry.id}
            style={[styles.listRow, index < data.users.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}
            onPress={() => router.push(`/admin/user/${entry.id}` as never)}
          >
            <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name="person-outline" size={18} color={theme.primary} /></View>
            <View style={styles.rowCopy}>
              <Text style={[styles.itemTitle, { color: theme.text }]}>{entry.name || entry.email}</Text>
              <Text style={[styles.itemSub, { color: theme.body }]}>{entry.email}{entry.username ? ` · @${entry.username}` : ""}</Text>
              <Text style={[styles.meta, { color: theme.muted }]}>{entry.room_count} rooms · {entry.friend_count} friends</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.muted} />
          </Pressable>
        )) : <EmptyState title="No users found" />}
      </AppCard>
    );
  }

  if (section === "rooms") {
    return (
      <AppCard style={styles.card}>
        <SectionLabel title="Rooms" description={`${data.total ?? data.rooms?.length ?? 0} rooms returned`} theme={theme} />
        {data.rooms?.length ? data.rooms.map((room: any, index: number) => (
          <Pressable
            key={room.id}
            style={[styles.listRow, index < data.rooms.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}
            onPress={() => router.push(`/admin/room/${room.id}` as never)}
          >
            <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name="receipt-outline" size={18} color={theme.primary} /></View>
            <View style={styles.rowCopy}>
              <Text style={[styles.itemTitle, { color: theme.text }]}>{room.name}</Text>
              <Text style={[styles.itemSub, { color: theme.body }]}>{room.member_count} members · {money(room.tracked_amount)} tracked</Text>
              <Text style={[styles.meta, { color: theme.muted }]}>{money(room.outstanding_amount)} outstanding</Text>
            </View>
            <StatusPill label={room.archived_at ? "Archived" : humanize(room.payment_status || "Active")} tone={room.archived_at ? "neutral" : "primary"} theme={theme} />
          </Pressable>
        )) : <EmptyState title="No rooms found" />}
      </AppCard>
    );
  }

  if (section === "overview") {
    return (
      <>
        <View style={styles.grid}>
          <Metric label="Users" value={String(data.users?.total ?? 0)} theme={theme} />
          <Metric label="Rooms" value={String(data.rooms?.total ?? 0)} theme={theme} />
          <Metric label="Tracked" value={money(data.expenses?.value)} theme={theme} />
          <Metric label="Settlements" value={String(data.settlements?.count ?? 0)} theme={theme} />
        </View>
        <AppCard style={styles.card}>
          <SectionLabel title="Admin workspace guide" description="What each area is for, using only capabilities backed by SplitVerse." theme={theme} />
          {[
            ["people-outline", "Users", "Investigate accounts, review activity, and restrict or block access when necessary."],
            ["receipt-outline", "Rooms", "Inspect room membership, expenses, tracked amounts, and settlement history."],
            ["git-compare-outline", "Settlement Debugger", "Explain why a user owes or receives an amount using the canonical calculation logic."],
            ["cash-outline", "Financial Activity", "Review recorded expenses, settlements, reversals, and wallet activity."],
            ["shield-checkmark-outline", "Security", "Review blocked/restricted accounts and installation-based ban-evasion signals."],
            ["analytics-outline", "Analytics", "Read real 30-day usage and financial aggregates without synthetic metrics."],
            ["options-outline", "App Control", "Manage feature flags, Android versions, and safe runtime configuration."],
            ["document-text-outline", "Admin Audit Logs", "See who changed administrative or financial state, when, and why."],
          ].map(([icon, label, description], index, rows) => (
            <View key={label} style={[styles.guideRow, index < rows.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
              <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name={icon as any} size={18} color={theme.primary} /></View>
              <View style={styles.rowCopy}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>{label}</Text>
                <Text style={[styles.itemSub, { color: theme.body }]}>{description}</Text>
              </View>
            </View>
          ))}
        </AppCard>
        <AppCard style={styles.card}>
          <SectionLabel title="Recent activity" description="Newest events available in the current data model." theme={theme} />
          {data.recentActivity?.length ? data.recentActivity.map((row: any, index: number) => (
            <View key={`${row.type}-${row.id}`} style={[styles.timelineRow, index < data.recentActivity.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
              <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
              <View style={styles.rowCopy}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>{row.label}</Text>
                <Text style={[styles.itemSub, { color: theme.body }]}>{humanize(row.type)} · {date(row.created_at)}</Text>
              </View>
            </View>
          )) : <EmptyState title="No recent activity" />}
        </AppCard>
      </>
    );
  }

  if (section === "settlements" && data.room) {
    return (
      <>
        <View style={styles.grid}>
          <Metric label="Net position" value={`${data.roomNet >= 0 ? "Receivable" : "Payable"} ${money(Math.abs(data.roomNet || 0))}`} theme={theme} />
          <Metric label="Debt lines" value={String(data.roomDebtLines?.length ?? 0)} theme={theme} />
        </View>
        <AppCard style={styles.card}>
          <SectionLabel title={`${data.user?.name || data.user?.email} · ${data.room?.name}`} description="Canonical room calculation trace" theme={theme} />
          {data.roomDebtLines?.length ? data.roomDebtLines.map((line: any, index: number) => (
            <View key={`${line.item_id}-${index}`} style={[styles.traceRow, { borderColor: theme.borderSoft, backgroundColor: theme.surface }]}>
              <View style={[styles.traceIndex, { backgroundColor: theme.primarySoft }]}><Text style={[styles.traceIndexText, { color: theme.primary }]}>{index + 1}</Text></View>
              <View style={styles.rowCopy}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>{line.item_title}</Text>
                <Text style={[styles.itemSub, { color: theme.body }]}>{line.debtor_name || line.debtor_email} owes {line.creditor_name || line.creditor_email}</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>Original {money(line.original_amount)} · Settled {money(line.settled_amount)} · Remaining {money(line.pending_amount)}</Text>
              </View>
            </View>
          )) : <EmptyState title="No pending debt lines" />}
        </AppCard>
      </>
    );
  }

  if (section === "analytics") return <AnalyticsContent data={data} theme={theme} />;

  if (section === "flags") {
    return (
      <AppCard style={styles.card}>
        <SectionLabel title="Feature flags" description="Current server-controlled flags." theme={theme} />
        {data.flags?.length ? data.flags.map((flag: any, index: number) => (
          <View key={flag.key} style={[styles.listRow, index < data.flags.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
            <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name="options-outline" size={18} color={theme.primary} /></View>
            <View style={styles.rowCopy}>
              <Text style={[styles.itemTitle, { color: theme.text }]}>{flag.key}</Text>
              <Text style={[styles.itemSub, { color: theme.body }]}>{flag.description || "No description"}</Text>
              <Text style={[styles.meta, { color: theme.muted }]}>Rollout {flag.rollout_percent}% · Updated {date(flag.updated_at)}</Text>
            </View>
            <StatusPill label={flag.enabled ? "Enabled" : "Disabled"} tone={flag.enabled ? "good" : "neutral"} theme={theme} />
          </View>
        )) : <EmptyState title="No feature flags" />}
      </AppCard>
    );
  }

  if (section === "versions" || section === "config") {
    const entries = Object.entries(data.config || {}).filter(([key]) => section === "versions" ? key.startsWith("android_") : !key.startsWith("android_"));
    return (
      <AppCard style={styles.card}>
        <SectionLabel title={section === "versions" ? "Android version controls" : "Application configuration"} description="Read from the same server-side configuration used by SplitVerse." theme={theme} />
        {entries.length ? entries.map(([key, config]: any, index) => (
          <View key={key} style={[styles.configRow, index < entries.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
            <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name={section === "versions" ? "phone-portrait-outline" : "settings-outline"} size={18} color={theme.primary} /></View>
            <View style={styles.rowCopy}>
              <Text style={[styles.itemTitle, { color: theme.text }]}>{humanize(key)}</Text>
              <Text style={[styles.itemSub, { color: theme.body }]}>{config.description || "Server-controlled configuration"}</Text>
              <Text style={[styles.meta, { color: theme.muted }]}>Updated {date(config.updatedAt)}</Text>
            </View>
            <Text style={[styles.configValue, { color: theme.text }]} numberOfLines={2}>{valueText(config.value)}</Text>
          </View>
        )) : <EmptyState title="No configuration found" />}
      </AppCard>
    );
  }

  if (section === "security") {
    const counts = data.counts || {};
    return (
      <>
        <View style={styles.grid}>
          <Metric label="Blocked accounts" value={String(counts.blocked ?? 0)} theme={theme} />
          <Metric label="Restricted accounts" value={String(counts.restricted ?? 0)} theme={theme} />
          <Metric label="Restricted installs" value={String(counts.restricted_installations ?? 0)} theme={theme} />
          <Metric label="Evasion signals · 30d" value={String(counts.evasion_signals_30d ?? 0)} theme={theme} />
        </View>

        <AppCard style={[styles.securityCard, { borderColor: theme.border }]}>
          <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} /></View>
          <View style={styles.rowCopy}>
            <Text style={[styles.itemTitle, { color: theme.text }]}>Layered account protection</Text>
            <Text style={[styles.itemSub, { color: theme.body }]}>{data.note}</Text>
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <SectionLabel title="Accounts requiring attention" description="Blocked or restricted accounts. Tap an account to investigate and change its status." theme={theme} />
          {data.accounts?.length ? data.accounts.map((entry: any, index: number) => (
            <Pressable
              key={entry.id}
              style={[styles.listRow, index < data.accounts.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}
              onPress={() => router.push(`/admin/user/${entry.id}` as never)}
            >
              <View style={[styles.iconBox, { backgroundColor: entry.status === "blocked" ? `${theme.danger}14` : `${theme.warning}14` }]}>
                <Ionicons name={entry.status === "blocked" ? "ban-outline" : "shield-outline"} size={18} color={entry.status === "blocked" ? theme.danger : theme.warning} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>{entry.name || entry.email}</Text>
                <Text style={[styles.itemSub, { color: theme.body }]}>{entry.email}</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>{entry.reason || "No reason recorded"} · {entry.restricted_installation_count || 0}/{entry.installation_count || 0} restricted installations</Text>
              </View>
              <StatusPill label={humanize(entry.status)} tone={entry.status === "blocked" ? "warning" : "primary"} theme={theme} />
            </Pressable>
          )) : <EmptyState title="No accounts currently restricted" />}
        </AppCard>

        <AppCard style={styles.card}>
          <SectionLabel title="Risk signals" description="Installation matches are evidence for review, not proof of identity." theme={theme} />
          {data.riskEvents?.length ? data.riskEvents.map((event: any, index: number) => (
            <View key={event.id} style={[styles.listRow, index < data.riskEvents.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
              <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name="warning-outline" size={18} color={theme.primary} /></View>
              <View style={styles.rowCopy}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>{humanize(event.event_type)}</Text>
                <Text style={[styles.itemSub, { color: theme.body }]}>{event.user_email || "Unknown account"}{event.related_user_email ? ` · related to ${event.related_user_email}` : ""}</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>{date(event.created_at)}</Text>
              </View>
            </View>
          )) : <EmptyState title="No security risk signals recorded" />}
        </AppCard>

        <FeedCard rows={data.events || []} theme={theme} empty="No recorded security actions" />
      </>
    );
  }

  if (section === "financial") return <FeedCard rows={data.activity || []} theme={theme} empty="No financial activity found" financial />;
  if (section === "audit") return <FeedCard rows={data.events || []} theme={theme} empty="No audit events found" />;
  if (section === "logs") return <FeedCard rows={data.logs || []} theme={theme} empty="No admin audit logs found" />;

  return <EmptyState title="No records found" />;
}

function FeedCard({ rows, theme, empty, financial = false }: { rows: any[]; theme: any; empty: string; financial?: boolean }) {
  return (
    <AppCard style={styles.card}>
      <SectionLabel title={financial ? "Activity" : "Recorded events"} description={`${rows.length} records loaded`} theme={theme} />
      {rows.length ? rows.map((row: any, index: number) => (
        <View key={row.id || `${row.action}-${row.created_at}-${index}`} style={[styles.listRow, index < rows.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
          <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name={financial ? "cash-outline" : "document-text-outline"} size={18} color={theme.primary} /></View>
          <View style={styles.rowCopy}>
            <Text style={[styles.itemTitle, { color: theme.text }]}>{row.label || humanize(row.action || row.type || "Activity")}</Text>
            <Text style={[styles.itemSub, { color: theme.body }]}>{row.user_email || row.admin_email || row.room_name || humanize(row.target_type || "System")}{row.amount != null ? ` · ${money(row.amount)}` : ""}</Text>
            {row.reason ? <Text style={[styles.meta, { color: theme.muted }]}>Reason: {row.reason}</Text> : null}
            <Text style={[styles.meta, { color: theme.muted }]}>{date(row.created_at)}</Text>
          </View>
        </View>
      )) : <EmptyState title={empty} />}
    </AppCard>
  );
}

function AnalyticsContent({ data, theme }: { data: any; theme: any }) {
  const cards = useMemo(() => [
    { key: "users", title: "New users", rows: data.userGrowth || [], valueKey: "value" },
    { key: "rooms", title: "New rooms", rows: data.roomGrowth || [], valueKey: "value" },
    { key: "expenses", title: "Expense value", rows: data.expenseActivity || [], valueKey: "value", money: true },
  ], [data]);

  return (
    <>
      {cards.map((card) => <MiniSeriesCard key={card.key} title={card.title} rows={card.rows} valueKey={card.valueKey} moneyValues={Boolean(card.money)} theme={theme} />)}
      <AppCard style={styles.card}>
        <SectionLabel title="Settlements by method" description="Recorded settlement activity" theme={theme} />
        {data.settlementsByMethod?.length ? data.settlementsByMethod.map((row: any, index: number) => (
          <View key={row.method} style={[styles.listRow, index < data.settlementsByMethod.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft }]}>
            <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}><Ionicons name="checkmark-circle-outline" size={18} color={theme.primary} /></View>
            <View style={styles.rowCopy}>
              <Text style={[styles.itemTitle, { color: theme.text }]}>{humanize(row.method)}</Text>
              <Text style={[styles.itemSub, { color: theme.body }]}>{row.count} records</Text>
            </View>
            <Text style={[styles.itemTitle, { color: theme.text }]}>{money(row.amount)}</Text>
          </View>
        )) : <EmptyState title="No settlement records" />}
      </AppCard>
    </>
  );
}

function MiniSeriesCard({ title, rows, valueKey, moneyValues, theme }: { title: string; rows: any[]; valueKey: string; moneyValues: boolean; theme: any }) {
  const values = rows.map((row) => Number(row[valueKey] || 0));
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    <AppCard style={styles.chartCard}>
      <View style={styles.chartHead}>
        <View style={styles.rowCopy}>
          <Text style={[styles.itemTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.itemSub, { color: theme.body }]}>Last 30 days</Text>
        </View>
        <Text style={[styles.chartTotal, { color: theme.text }]}>{moneyValues ? money(total) : String(total)}</Text>
      </View>
      {rows.length ? (
        <View style={styles.bars}>
          {rows.map((row, index) => {
            const value = Number(row[valueKey] || 0);
            return <View key={`${row.day}-${index}`} style={styles.barColumn}><View style={[styles.bar, { backgroundColor: theme.primary, height: `${Math.max(8, (value / max) * 100)}%` }]} /></View>;
          })}
        </View>
      ) : <EmptyState title="No activity in this period" />}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.base },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: spacing.sm },
  back: { width: 42, height: 42, borderWidth: 1, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  header: { gap: spacing.xs, marginBottom: spacing.xs },
  eyebrow: { ...typography.caption, letterSpacing: 0.6 },
  title: { ...typography.titleLg, fontWeight: "500" },
  subtitle: { ...typography.bodySm, maxWidth: 620 },
  card: { gap: spacing.sm },
  sectionLabel: { gap: 3, marginBottom: spacing.xs },
  sectionTitle: { ...typography.titleMd },
  listRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  configRow: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { ...typography.titleSm },
  itemSub: { ...typography.bodySm, fontSize: 12, lineHeight: 18 },
  meta: { ...typography.caption, fontSize: 10, lineHeight: 15, fontWeight: "500" },
  statusPill: { minHeight: 28, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  statusText: { ...typography.caption, fontSize: 10, lineHeight: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { width: "48%", minHeight: 104, gap: spacing.xs, justifyContent: "space-between" },
  metricLabel: { ...typography.caption },
  metricValue: { ...typography.titleMd, fontSize: 20, lineHeight: 25 },
  guideRow: { minHeight: 72, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.sm },
  timelineRow: { minHeight: 54, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.sm },
  timelineDot: { width: 9, height: 9, borderRadius: radius.full, marginTop: 5 },
  traceRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  traceIndex: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  traceIndexText: { ...typography.caption },
  configValue: { ...typography.titleSm, maxWidth: "34%", textAlign: "right" },
  securityCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderWidth: 1 },
  errorCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderWidth: 1 },
  errorCopy: { flex: 1, gap: 3 },
  errorTitle: { ...typography.titleSm },
  chartCard: { gap: spacing.base, minHeight: 210 },
  chartHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  chartTotal: { ...typography.titleMd },
  bars: { height: 120, flexDirection: "row", alignItems: "flex-end", gap: 3, paddingTop: spacing.sm },
  barColumn: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", minHeight: 8, borderRadius: 3 },
});
