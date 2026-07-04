import { StyleSheet, Text, View } from "react-native";
import AppButton from "../src/components/AppButton";
import AppCard from "../src/components/AppCard";
import Screen from "../src/components/Screen";
import { colors, spacing, typography } from "../src/theme/tokens";

export default function Index() {
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.badge}>SplitVerse Mobile</Text>
        <Text style={styles.title}>Split bills fairly, item by item.</Text>
        <Text style={styles.subtitle}>
          Track shared expenses, settle dues, manage friends, and use your
          wallet from one clean mobile app.
        </Text>

        <View style={styles.actions}>
          <AppButton title="Get started" />
          <AppButton title="Sign in" variant="secondary" />
        </View>
      </View>

      <AppCard style={styles.previewCard}>
        <Text style={styles.cardEyebrow}>Mobile setup</Text>
        <Text style={styles.cardTitle}>Foundation is ready</Text>
        <Text style={styles.cardText}>
          Next we will add Firebase auth, protected tabs, dashboard, friends,
          split rooms, wallet, and transactions.
        </Text>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.base,
    paddingTop: spacing.xxl,
  },
  badge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 100,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.ink,
    ...typography.caption,
  },
  title: {
    color: colors.ink,
    ...typography.titleLg,
  },
  subtitle: {
    color: colors.body,
    ...typography.body,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  previewCard: {
    marginTop: spacing.xl,
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
});