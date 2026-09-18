import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Text from "../src/components/LocalizedText";
import Screen from "../src/components/Screen";
import { useAuth } from "../src/context/AuthContext";
import { useAppSettings } from "../src/context/useAppSettings";
import { radius, spacing, typography } from "../src/theme/tokens";

export default function Index() {
  const { user, initializing } = useAuth();
  const { theme } = useAppSettings();

  if (initializing) {
    return (
      <Screen scroll={false} safeBackgroundColor={theme.background}>
        <View
          style={[
            styles.loadingScreen,
            { backgroundColor: theme.background },
          ]}
        >
          <ActivityIndicator color={theme.primary} />
        </View>
      </Screen>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <Screen scroll={false} safeBackgroundColor={theme.background}>
      <LinearGradient
        colors={
          theme.mode === "dark"
            ? ["#0a0b0d", "#101216", "#0a0b0d"]
            : ["#f6f1e7", "#fffdf9", "#f6f1e7"]
        }
        style={styles.screen}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.mode === "dark" ? theme.card : theme.canvas,
              borderColor: theme.borderSoft,
            },
          ]}
        >
          <View
            style={[
              styles.heroArtWrap,
              { backgroundColor: theme.mode === "dark" ? "#f7f9fb" : "#ffffff" },
            ]}
          >
            <Image
              source={require("../assets/welcome-hero.png")}
              style={styles.heroArt}
              resizeMode="contain"
            />
          </View>

          <View style={styles.brandWrap}>
            <Image
              source={require("../assets/splitverse-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.brand, { color: theme.text }]}>SplitVerse</Text>
            <Text style={[styles.subtitle, { color: theme.body }]}>
              Split smarter. Track shared expenses, create rooms, and settle faster.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: pressed ? theme.primaryActive : theme.primary,
              },
            ]}
            onPress={() => router.replace("/(auth)/signup")}
          >
            <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>Get Started</Text>
          </Pressable>

          <Pressable style={styles.signInButton} onPress={() => router.push("/(auth)/login")}>
            <Text style={[styles.signInText, { color: theme.primary }]}>I already have an account</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  screen: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
    justifyContent: "space-between",
  },
  heroCard: {
    flex: 1,
    borderRadius: 32,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroArtWrap: {
    margin: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: 28,
    overflow: "hidden",
    minHeight: 360,
    justifyContent: "center",
    alignItems: "center",
  },
  heroArt: {
    width: "100%",
    height: 360,
  },
  brandWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  logo: {
    width: 76,
    height: 76,
  },
  brand: {
    ...typography.titleLg,
    fontSize: 36,
    lineHeight: 40,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    textAlign: "center",
    maxWidth: 290,
  },
  footer: {
    paddingTop: spacing.base,
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    ...typography.button,
    fontSize: 17,
  },
  signInButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  signInText: {
    ...typography.bodySm,
    fontWeight: "700",
  },
});
