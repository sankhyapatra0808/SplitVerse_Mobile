import { Redirect, router } from "expo-router";
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
          style={[styles.loadingScreen, { backgroundColor: theme.background }]}
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
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.frame,
            {
              backgroundColor:
                theme.mode === "dark" ? theme.background : theme.canvas,
              borderColor: theme.borderSoft,
            },
          ]}
        >
          <View style={styles.topBar}>
            <Text style={[styles.topBarTitle, { color: theme.text }]}>
              SplitVerse
            </Text>
          </View>

          <View style={styles.heroSection}>
            <Image
              source={require("../assets/welcome-hero.png")}
              style={styles.heroImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.infoStrip}>
            <Image
              source={require("../assets/splitverse-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.bigS, { color: theme.text }]}>S</Text>
            <View style={styles.infoTextWrap}>
              <Text style={[styles.tagline, { color: theme.body }]}>
                plit smarter.
              </Text>
              <Text style={[styles.tagline, { color: theme.body }]}>
                plit wiser.
              </Text>
              <Text style={[styles.tagline, { color: theme.body }]}>
                ettle faster.
              </Text>
            </View>
          </View>

          <View style={styles.footerSection}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: pressed
                    ? theme.primaryActive
                    : theme.primary,
                },
              ]}
              onPress={() => router.replace("/(auth)/signup")}
            >
              <Text
                style={[styles.primaryButtonText, { color: theme.onPrimary }]}
              >
                Get Started
              </Text>
            </Pressable>

            <Pressable
              style={styles.signInButton}
              onPress={() => router.push("/(auth)/login")}
            >
              <Text style={[styles.signInText, { color: theme.body }]}>
                I already have an account
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
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
  },
  frame: {
    flex: 1,
  },
  topBar: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.base,
    paddingTop: 70,
  },
  topBarTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  heroSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    maxHeight: 420,
  },

  bigS: {
    fontSize: 72,
    lineHeight: 76,
    fontWeight: "700",
  },

  taglineBlock: {
    justifyContent: "center",
  },

  tagline: {
    ...typography.bodySm,
    fontSize: 17,
    lineHeight: 23,
  },

  infoStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
  },
  logo: {
    width: 66,
    height: 66,
    borderRadius: 15,
  },
  infoTextWrap: {
    alignItems: "center",
  },
  brandTitle: {
    ...typography.titleMd,
    fontSize: 28,
    lineHeight: 32,
    marginBottom: 4,
    textAlign: "center",
  },
  footerSection: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    gap: 6,
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
    fontSize: 18,
  },
  signInButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  signInText: {
    ...typography.bodySm,
  },
});
