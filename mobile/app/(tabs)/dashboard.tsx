import { useEffect, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import Screen from "../../src/components/Screen";
import { getDashboardSummary, type DashboardSummary } from "../../src/lib/api";
import { useAuth } from "../../src/context/AuthContext";
import { colors, spacing, typography } from "../../src/theme/tokens";

function formatMoney(value?: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSummary() {
    try {
      setLoading(true);
      const data = await getDashboardSummary();
      setSummary(data);
    } catch (error) {
      Alert.alert(
        "Dashboard failed",
        error instanceof Error ? error.message : "Could not load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SplitVerse</Text>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
      </View>

      <View style={styles.grid}>
        <AppCard style={styles.statCard}>
          <Text style={styles.statLabel}>Wallet balance</Text>
          <Text style={styles.statValue}>
            {loading ? "Loading..." : formatMoney(summary?.walletHealth?.availableBalance ?? summary?.metrics?.walletBalance)}
          </Text>
        </AppCard>

        <AppCard style={styles.statCard}>
          <Text style={styles.statLabel}>Monthly spend</Text>
          <Text style={styles.statValue}>
            {loading ? "Loading..." : formatMoney(summary?.monthlySpend?.currentMonthTotal ?? summary?.monthlySpend?.graphTotal)}
          </Text>
        </AppCard>

        <AppCard style={styles.statCard}>
          <Text style={styles.statLabel}>Pending outgoing</Text>
          <Text style={styles.statValue}>
            {loading ? "Loading..." : formatMoney(summary?.walletHealth?.payable ?? summary?.metrics?.pendingPayment)}
          </Text>
        </AppCard>

        <AppCard style={styles.statCard}>
          <Text style={styles.statLabel}>Pending incoming</Text>
          <Text style={styles.statValue}>
            {loading ? "Loading..." : formatMoney(summary?.walletHealth?.receivable)}
          </Text>
        </AppCard>
      </View>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Mobile API connection</Text>
        <Text style={styles.cardText}>
          This screen is now calling your SplitVerse backend using the Firebase
          login token.
        </Text>

        <View style={styles.actions}>
          <AppButton title="Refresh dashboard" onPress={loadSummary} loading={loading} />
          <AppButton title="Logout" variant="secondary" onPress={logout} />
        </View>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    paddingTop: spacing.xl,
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
  grid: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  statCard: {
    gap: spacing.xs,
  },
  statLabel: {
    color: colors.body,
    ...typography.caption,
  },
  statValue: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "400",
    lineHeight: 34,
  },
  card: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  cardTitle: {
    color: colors.ink,
    ...typography.titleMd,
  },
  cardText: {
    color: colors.body,
    ...typography.bodySm,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});