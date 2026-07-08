import { router } from "expo-router";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import AppButton from "../src/components/AppButton";
import AppCard from "../src/components/AppCard";
import Screen from "../src/components/Screen";
import Text from "../src/components/LocalizedText";
import { useAuth } from "../src/context/AuthContext";
import { colors, radius, spacing, typography } from "../src/theme/tokens";

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
    <Screen contentStyle={styles.screen}>
      <View style={styles.heroCard}>
        <View style={styles.logoShell}>
          <Image source={require("../assets/splitverse-logo.png")} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.badge}>SplitVerse mobile</Text>
        <Text style={styles.title}>Split bills fairly, item by item.</Text>
        <Text style={styles.subtitle}>
          Create rooms, assign exact items, settle wallet dues, and keep every friend balance clean.
        </Text>

        <View style={styles.actions}>
          {user ? (
            <AppButton title="Continue to dashboard" onPress={() => router.replace("/(tabs)/dashboard")} />
          ) : (
            <>
              <AppButton title="Get started" onPress={() => router.push("/(auth)/signup")} />
              <AppButton title="Sign in" variant="secondary" onPress={() => router.push("/(auth)/login")} />
            </>
          )}
        </View>
      </View>

      <View style={styles.featureGrid}>
        <AppCard style={styles.featureCard}>
          <Text style={styles.cardEyebrow}>Fair splitting</Text>
          <Text style={styles.cardTitle}>Pay only for what you used</Text>
          <Text style={styles.cardText}>Assign each item to the right member instead of dividing blindly.</Text>
        </AppCard>

        <AppCard style={styles.featureCard}>
          <Text style={styles.cardEyebrow}>Wallet ready</Text>
          <Text style={styles.cardTitle}>Top up and settle</Text>
          <Text style={styles.cardText}>Use Razorpay wallet top-up and pay adjusted net dues from mobile.</Text>
        </AppCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.base,
    backgroundColor: colors.surfaceSoft,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    minHeight: 520,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.base,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: 34,
    backgroundColor: colors.canvas,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  logoShell: {
    width: 116,
    height: 116,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 34,
    backgroundColor: colors.surfaceSoft,
    marginBottom: spacing.sm,
  },
  logo: {
    width: 92,
    height: 92,
  },
  badge: {
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.primary,
    ...typography.caption,
  },
  title: {
    textAlign: "center",
    color: colors.ink,
    ...typography.titleLg,
  },
  subtitle: {
    textAlign: "center",
    color: colors.body,
    ...typography.body,
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  featureGrid: {
    gap: spacing.base,
  },
  featureCard: {
    gap: spacing.xs,
  },
  cardEyebrow: {
    color: colors.body,
    ...typography.caption,
  },
  cardTitle: {
    color: colors.ink,
    ...typography.titleMd,
  },
  cardText: {
    color: colors.body,
    ...typography.bodySm,
  },
});
