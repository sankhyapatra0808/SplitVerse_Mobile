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

const ART_WIDTH = 941;
const ART_HEIGHT = 1672;

type SourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function mapSourceRectToCover(
  rect: SourceRect,
  viewportWidth: number,
  viewportHeight: number,
) {
  const scale = Math.max(
    viewportWidth / ART_WIDTH,
    viewportHeight / ART_HEIGHT,
  );

  const renderedWidth = ART_WIDTH * scale;
  const renderedHeight = ART_HEIGHT * scale;

  const offsetX = (viewportWidth - renderedWidth) / 2;
  const offsetY = (viewportHeight - renderedHeight) / 2;

  return {
    left: offsetX + rect.x * scale,
    top: offsetY + rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

export default function Index() {
  const { user, initializing } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (initializing) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" translucent backgroundColor="transparent" />

        <ActivityIndicator color="#159b87" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const compact = width < 370;

  const artworkScale = Math.max(width / ART_WIDTH, height / ART_HEIGHT);

  const getStartedButtonRect = mapSourceRectToCover(
    {
      x: 179,
      y: 1490,
      width: 583,
      height: 102,
    },
    width,
    height,
  );

  const signInButtonRect = mapSourceRectToCover(
    {
      x: 350,
      y: 1590,
      width: 240,
      height: 56,
    },
    width,
    height,
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      <ImageBackground
        source={require("../assets/landing-split-bills.png")}
        style={StyleSheet.absoluteFill}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* SplitVerse branding */}
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
        <View style={[styles.logoShell, compact && styles.logoShellCompact]}>
          <Image
            source={require("../assets/splitverse-logo.png")}
            style={[styles.logo, compact && styles.logoCompact]}
            resizeMode="contain"
          />
        </View>

        <View style={styles.brandCopy}>
          <NativeText
            numberOfLines={1}
            style={[styles.brandName, compact && styles.brandNameCompact]}
          >
            <NativeText style={styles.brandSplit}>Split</NativeText>

            <NativeText style={styles.brandVerse}>Verse</NativeText>
          </NativeText>

          <NativeText
            numberOfLines={1}
            style={[styles.brandTagline, compact && styles.brandTaglineCompact]}
          >
            BILLS ARE BETTER TOGETHER
          </NativeText>
        </View>
      </View>

      {/* Skip */}
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
          style={[styles.skipText, compact && styles.skipTextCompact]}
        >
          Skip
        </NativeText>
      </Pressable>

      {/* Get Started */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Get Started"
        onPress={() => router.replace("/(auth)/signup")}
        style={({ pressed }) => [
          styles.getStartedButton,
          getStartedButtonRect,
          pressed && styles.realButtonPressed,
        ]}
      >
        <LinearGradient
          colors={["#2DAD9E", "#1E968A", "#158176"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.getStartedGradient}
        >
          <NativeText
            style={[
              styles.getStartedText,
              {
                fontSize: Math.max(15, Math.min(20, 31 * artworkScale)),
                lineHeight: Math.max(19, Math.min(25, 38 * artworkScale)),
              },
            ]}
          >
            Get Started →
          </NativeText>
        </LinearGradient>
      </Pressable>

      {/* Sign In */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign In"
        onPress={() => router.push("/(auth)/login")}
        hitSlop={8}
        style={({ pressed }) => [
          styles.signInButton,
          signInButtonRect,
          pressed && styles.signInButtonPressed,
        ]}
      >
        <NativeText
          style={[
            styles.signInText,
            {
              fontSize: Math.max(14, Math.min(18, 28 * artworkScale)),
              lineHeight: Math.max(18, Math.min(23, 34 * artworkScale)),
            },
          ]}
        >
          Sign In
        </NativeText>
      </Pressable>
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

  skipButton: {
    position: "absolute",
    zIndex: 4,

    minWidth: 58,
    height: 42,

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

  getStartedButton: {
    position: "absolute",
    zIndex: 5,

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

  getStartedGradient: {
    flex: 1,
    borderRadius: 999,

    alignItems: "center",
    justifyContent: "center",
  },

  getStartedText: {
    color: "#ffffff",

    fontSize: 25,
    lineHeight: 30,

    fontWeight: "800",
    letterSpacing: 0.1,
  },

  realButtonPressed: {
    opacity: 0.96,
  },

  signInButton: {
    position: "absolute",
    zIndex: 5,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 999,
  },

  signInButtonPressed: {
    opacity: 0.62,
  },

  signInText: {
    color: "#586C84",

    fontSize: 21,
    lineHeight: 27,

    fontWeight: "700",
  },
});
