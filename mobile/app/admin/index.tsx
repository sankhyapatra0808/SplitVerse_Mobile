import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Screen from "../../src/components/Screen";
import AppCard from "../../src/components/AppCard";
import Text from "../../src/components/LocalizedText";
import LoadingState from "../../src/components/LoadingState";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import { resolveAdminAccess } from "../../src/lib/adminAccess";
import { spacing, radius, typography } from "../../src/theme/tokens";

type ModuleKey =
  | "overview"
  | "users"
  | "rooms"
  | "settlements"
  | "financial"
  | "audit"
  | "analytics"
  | "flags"
  | "versions"
  | "config"
  | "security"
  | "logs";

type AdminModule = {
  key: ModuleKey;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const groups: Array<{ label: string; modules: AdminModule[] }> = [
  {
    label: "Operations",
    modules: [
      { key: "overview", label: "Overview", description: "Live operational metrics", icon: "pulse-outline" },
      { key: "users", label: "Users", description: "Accounts and activity", icon: "people-outline" },
      { key: "rooms", label: "Rooms", description: "Room and expense investigation", icon: "home-outline" },
      { key: "settlements", label: "Settlement Debugger", description: "Trace payable and receivable amounts", icon: "git-compare-outline" },
      { key: "financial", label: "Financial Activity", description: "Recorded expense and settlement events", icon: "card-outline" },
    ],
  },
  {
    label: "Insights",
    modules: [
      { key: "audit", label: "Audit & Integrity", description: "Traceable administrative activity", icon: "document-text-outline" },
      { key: "analytics", label: "Analytics", description: "Real database aggregates", icon: "bar-chart-outline" },
    ],
  },
  {
    label: "App control",
    modules: [
      { key: "flags", label: "Feature Flags", description: "Server-controlled product switches", icon: "options-outline" },
      { key: "versions", label: "App Versions", description: "Android update configuration", icon: "phone-portrait-outline" },
      { key: "config", label: "Configuration", description: "Runtime-safe product settings", icon: "settings-outline" },
    ],
  },
  {
    label: "System",
    modules: [
      { key: "security", label: "Security", description: "Supported security controls and events", icon: "shield-checkmark-outline" },
      { key: "logs", label: "Admin Audit Logs", description: "Append-only administrator history", icon: "time-outline" },
    ],
  },
];

export default function AdminPortal() {
  const { user } = useAuth();
  const { theme } = useAppSettings();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    resolveAdminAccess(user?.email)
      .then((value) => {
        setAllowed(value);
        if (!value) router.replace("/(tabs)/settings");
      })
      .catch(() => {
        setAllowed(false);
        router.replace("/(tabs)/settings");
      });
  }, [user?.email]);

  if (allowed !== true) return <LoadingState />;

  return (
    <Screen swipeTabs={false} contentStyle={styles.screen}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Settings"
          style={[styles.back, { borderColor: theme.border, backgroundColor: theme.canvas }]}
          onPress={() => router.replace("/(tabs)/settings")}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </Pressable>
        <View style={[styles.securePill, { borderColor: theme.border, backgroundColor: theme.canvas }]}>
          <Ionicons name="shield-checkmark" size={14} color={theme.primary} />
          <Text style={[styles.secureText, { color: theme.body }]}>Authorized admin</Text>
        </View>
      </View>

      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>SPLITVERSE ADMIN</Text>
        <Text style={[styles.title, { color: theme.text }]}>Operations & control</Text>
        <Text style={[styles.body, { color: theme.body }]}>Investigate users, rooms and settlements, then manage supported product controls from one secure workspace.</Text>
      </View>

      {groups.map((group) => (
        <View style={styles.group} key={group.label}>
          <Text style={[styles.groupLabel, { color: theme.muted }]}>{group.label.toUpperCase()}</Text>
          <AppCard style={styles.card}>
            {group.modules.map((module, index) => (
              <Pressable
                key={module.key}
                style={[
                  styles.row,
                  index < group.modules.length - 1 && { borderBottomWidth: 1, borderColor: theme.borderSoft },
                ]}
                onPress={() => router.push(`/admin/${module.key}` as never)}
              >
                <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}>
                  <Ionicons name={module.icon} size={20} color={theme.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowText, { color: theme.text }]}>{module.label}</Text>
                  <Text style={[styles.rowSub, { color: theme.body }]}>{module.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.muted} />
              </Pressable>
            ))}
          </AppCard>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  back: { width: 42, height: 42, borderWidth: 1, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  securePill: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
  secureText: { ...typography.caption, fontWeight: "500" },
  header: { gap: spacing.xs },
  eyebrow: { ...typography.caption, letterSpacing: 0.6 },
  title: { ...typography.titleLg, fontWeight: "500" },
  body: { ...typography.bodySm, maxWidth: 620 },
  group: { gap: spacing.xs },
  groupLabel: { ...typography.caption, fontSize: 11, letterSpacing: 0.7 },
  card: { gap: 0, paddingVertical: 0 },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  iconBox: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowText: { ...typography.titleSm },
  rowSub: { ...typography.bodySm, fontSize: 12, lineHeight: 17 },
});
