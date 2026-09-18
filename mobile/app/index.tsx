import { Redirect, router } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text as NativeText,
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
        <View style={styles.frame}>
          {/* TOP SPLITVERSE BRAND */}
          <View style={styles.topBar}>
            <View style={styles.topBrand}>
              <Image
                source={require("../assets/splitverse-logo.png")}
                style={styles.topLogo}
                resizeMode="contain"
              />

              <NativeText style={styles.topBrandText}>
                <NativeText style={{ color: theme.text }}>Split</NativeText>

                <NativeText style={{ color: theme.primary }}>Verse</NativeText>
              </NativeText>
            </View>
          </View>

          {/* MAIN HERO IMAGE */}
          <View style={styles.heroSection}>
            <Image
              source={require("../assets/welcome-hero.png")}
              style={styles.heroImage}
              resizeMode="contain"
            />
          </View>

          {/* SPLIT SMARTER / WISER / SETTLE FASTER */}
          <View style={styles.sloganRow}>
            <NativeText style={[styles.bigS, { color: theme.text }]}>
              S
            </NativeText>

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

          {/* ACTIONS */}
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
    minHeight: 105,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 22,
  },

  topBrand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  topLogo: {
    width: 60,
    height: 60,
    borderRadius: 15,
  },

  topBrandText: {
    fontFamily: "LibreBaskerville_700Bold",
    fontSize: 40,
    lineHeight: 54,
    letterSpacing: -1,
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

  sloganRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 10,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },

  bigS: {
    fontFamily: "LibreBaskerville_700Bold",
    fontSize: 90,
    lineHeight: 108,
    letterSpacing: -2,
  },

  infoTextWrap: {
    justifyContent: "center",
    alignItems: "flex-start",
  },

  tagline: {
    ...typography.bodySm,
    fontSize: 18,
    lineHeight: 24,
  },

  footerSection: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    gap: 6,
  },

  primaryButton: {
    minHeight: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    alignSelf: "center",
    width: "85%",
  },

  primaryButtonText: {
    ...typography.button,
    fontSize: 20,
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
