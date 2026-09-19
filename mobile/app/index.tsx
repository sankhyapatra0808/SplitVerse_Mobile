import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
  useWindowDimensions,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { user, initializing } = useAuth();

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (initializing) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar
          style="dark"
          translucent
          backgroundColor="transparent"
        />

        <ActivityIndicator color="#159b87" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const compact = width < 370;

  /*
   * Keep the CTA width consistent across devices.
   *
   * Small phones:
   *   18px side spacing
   *
   * Normal phones:
   *   24px side spacing
   *
   * Tablets / very wide screens:
   *   maximum width is limited so the button
   *   doesn't become ridiculously large.
   */
  const horizontalPadding = compact ? 18 : 24;

  const actionWidth = Math.min(
    width - horizontalPadding * 2,
    560,
  );

  return (
    <View style={styles.screen}>
      <StatusBar
        style="dark"
        translucent
        backgroundColor="transparent"
      />

      {/* BACKGROUND ARTWORK */}
      <ImageBackground
        source={require("../assets/landing-split-bills.png")}
        style={StyleSheet.absoluteFill}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* SPLITVERSE BRANDING */}
      <View
        pointerEvents="box-none"
        style={[
          styles.brandRow,
          {
            top: insets.top + (compact ? 6 : 10),
            left: compact ? 18 : 24,
          },
        ]}
      >
        <View
          style={[
            styles.logoShell,
            compact && styles.logoShellCompact,
          ]}
        >
          <Image
            source={require("../assets/splitverse-logo.png")}
            style={[
              styles.logo,
              compact && styles.logoCompact,
            ]}
            resizeMode="contain"
          />
        </View>

        <View style={styles.brandCopy}>
          <NativeText
            numberOfLines={1}
            style={[
              styles.brandName,
              compact && styles.brandNameCompact,
            ]}
          >
            <NativeText style={styles.brandSplit}>
              Split
            </NativeText>

            <NativeText style={styles.brandVerse}>
              Verse
            </NativeText>
          </NativeText>

          <NativeText
            numberOfLines={1}
            style={[
              styles.brandTagline,
              compact && styles.brandTaglineCompact,
            ]}
          >
            BILLS ARE BETTER TOGETHER
          </NativeText>
        </View>
      </View>

      {/* SKIP BUTTON */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip to sign in"
        onPress={() => router.push("/(auth)/login")}
        style={({ pressed }) => [
          styles.skipButton,
          {
            top: insets.top + (compact ? 8 : 12),
            right: compact ? 16 : 24,
            opacity: pressed ? 0.72 : 1,
          },
        ]}
      >
        <NativeText
          style={[
            styles.skipText,
            compact && styles.skipTextCompact,
          ]}
        >
          Skip
        </NativeText>
      </Pressable>

      {/* BOTTOM ACTION AREA */}
      <View
        pointerEvents="box-none"
        style={[
          styles.bottomActions,
          {
            /*
             * Everything is positioned relative to
             * the bottom safe area of the actual phone.
             *
             * This is what keeps the buttons consistent
             * between Samsung / Pixel / OnePlus / etc.
             */
            bottom: Math.max(insets.bottom, 12),

            width: actionWidth,
          },
        ]}
      >
        {/* GET STARTED */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get Started"
          onPress={() => router.replace("/(auth)/signup")}
          style={({ pressed }) => [
            styles.getStartedButton,
            compact && styles.getStartedButtonCompact,
            pressed && styles.realButtonPressed,
          ]}
        >
          <LinearGradient
            colors={[
              "#2DAD9E",
              "#1E968A",
              "#158176",
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.getStartedGradient}
          >
            <NativeText
              style={[
                styles.getStartedText,
                compact && styles.getStartedTextCompact,
              ]}
            >
              Get Started →
            </NativeText>
          </LinearGradient>
        </Pressable>

        {/* SIGN IN */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign In"
          onPress={() => router.push("/(auth)/login")}
          hitSlop={8}
          style={({ pressed }) => [
            styles.signInButton,
            pressed && styles.signInButtonPressed,
          ]}
        >
          <NativeText
            style={[
              styles.signInText,
              compact && styles.signInTextCompact,
            ]}
          >
            Sign In
          </NativeText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f0fdfd",
    overflow: "hidden",
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdfd",
  },

  backgroundImage: {
    backgroundColor: "#f0fdfd",
  },

  /*
   * ============================
   * BRAND
   * ============================
   */

  brandRow: {
    position: "absolute",
    zIndex: 3,

    flexDirection: "row",
    alignItems: "center",

    maxWidth: "72%",
  },

  logoShell: {
    width: 50,
    height: 50,

    borderRadius: 14,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(223, 250, 245, 0.94)",

    shadowColor: "#8cbeb8",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.16,
    shadowRadius: 9,

    elevation: 2,
  },

  logoShellCompact: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },

  logo: {
    width: 41,
    height: 41,
    borderRadius: 10,
  },

  logoCompact: {
    width: 36,
    height: 36,
    borderRadius: 9,
  },

  brandCopy: {
    marginLeft: 10,

    justifyContent: "center",

    minWidth: 0,
  },

  brandName: {
    fontSize: 28,
    lineHeight: 31,

    fontWeight: "900",

    letterSpacing: -1.1,
  },

  brandNameCompact: {
    fontSize: 24,
    lineHeight: 27,
  },

  brandSplit: {
    color: "#0c1b3a",
  },

  brandVerse: {
    color: "#149b87",
  },

  brandTagline: {
    marginTop: 1,

    color: "#65728c",

    fontSize: 8.5,
    lineHeight: 11,

    letterSpacing: 1.7,

    fontWeight: "700",
  },

  brandTaglineCompact: {
    fontSize: 7.2,
    letterSpacing: 1.35,
  },

  /*
   * ============================
   * SKIP
   * ============================
   */

  skipButton: {
    position: "absolute",
    zIndex: 4,

    minWidth: 58,
    height: 42,

    paddingHorizontal: 16,

    borderRadius: 23,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(226, 240, 240, 0.88)",
  },

  skipText: {
    color: "#65728c",

    fontSize: 16,
    lineHeight: 20,

    fontWeight: "700",
  },

  skipTextCompact: {
    fontSize: 14,
  },

  /*
   * ============================
   * BOTTOM CTA AREA
   * ============================
   */

  bottomActions: {
    position: "absolute",

    zIndex: 5,

    alignSelf: "center",
    alignItems: "center",
  },

  /*
   * GET STARTED
   */

  getStartedButton: {
    width: "100%",
    height: 60,

    borderRadius: 999,

    overflow: "hidden",

    shadowColor: "#0e746b",

    shadowOffset: {
      width: 0,
      height: 7,
    },

    shadowOpacity: 0.18,
    shadowRadius: 14,

    elevation: 5,
  },

  getStartedButtonCompact: {
    height: 56,
  },

  getStartedGradient: {
    flex: 1,

    width: "100%",

    borderRadius: 999,

    alignItems: "center",
    justifyContent: "center",
  },

  getStartedText: {
    color: "#ffffff",

    fontSize: 19,
    lineHeight: 24,

    fontWeight: "800",

    letterSpacing: 0.1,
  },

  getStartedTextCompact: {
    fontSize: 17,
    lineHeight: 22,
  },

  realButtonPressed: {
    opacity: 0.9,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  /*
   * SIGN IN
   */

  signInButton: {
    height: 48,

    minWidth: 130,

    marginTop: 4,

    paddingHorizontal: 20,

    borderRadius: 999,

    alignItems: "center",
    justifyContent: "center",
  },

  signInButtonPressed: {
    opacity: 0.62,
  },

  signInText: {
    color: "#586C84",

    fontSize: 17,
    lineHeight: 22,

    fontWeight: "700",
  },

  signInTextCompact: {
    fontSize: 16,
    lineHeight: 21,
  },
});