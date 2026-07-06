import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AppButton from "../src/components/AppButton";
import AppCard from "../src/components/AppCard";
import Screen from "../src/components/Screen";
import { useAuth } from "../src/context/AuthContext";
import { colors, spacing, typography } from "../src/theme/tokens";

export default function Index() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.badge}>SplitVerse</Text>
        <Text style={styles.title}>Split bills fairly, item by item.</Text>
        <Text style={styles.subtitle}>
          Track shared expenses, assign items, settle dues, manage friends, and
          use your wallet from one clean mobile app.
        </Text>

        <View style={styles.actions}>
          {user ? (
            <AppButton
              title="Continue to dashboard"
              onPress={() => router.replace("/(tabs)/dashboard")}
            />
          ) : (
            <>
              <AppButton
                title="Get started"
                onPress={() => router.push("/(auth)/signup")}
              />
              <AppButton
                title="Sign in"
                variant="secondary"
                onPress={() => router.push("/(auth)/login")}
              />
            </>
          )}
        </View>
      </View>

      <AppCard style={styles.previewCard}>
        <Text style={styles.cardEyebrow}>Fair splitting</Text>
        <Text style={styles.cardTitle}>Pay only for what you used</Text>
        <Text style={styles.cardText}>
          Restaurant bills, room expenses, wallet dues, and friend settlements
          stay clean and transparent.
        </Text>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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