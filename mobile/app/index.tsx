import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
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
      <Screen scroll={false} safeBackgroundColor={theme.primary}>
        <LinearGradient colors={[theme.primary, theme.primaryActive]} style={styles.loadingScreen}>
          <ActivityIndicator color="#ffffff" />
        </LinearGradient>
      </Screen>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <Screen scroll={false} safeBackgroundColor={theme.primary}>
      <LinearGradient colors={[theme.primary, theme.primaryActive, theme.primary]} style={styles.screen}>
        <View style={styles.orbitOne} />
        <View style={styles.orbitTwo} />
        <View style={styles.orbitThree} />

        <Text style={styles.brand}>SplitVerse</Text>

        <View style={styles.heroCenter}>
          <Text style={styles.title}>Splitting,{"\n"}simplified</Text>

          <View style={styles.illustrationWrap}>
            <View style={styles.yellowBlob} />
            <Image source={require("../assets/splitverse-logo.png")} style={styles.logo} resizeMode="contain" />
            <View style={styles.plusBadge}>
              <Text style={[styles.plusText, { color: theme.text }]}>+4</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>Everything you need to split expenses fairly.</Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.mode === "dark" ? theme.primary : "#ffffff" }]}
            onPress={() => router.replace("/(auth)/signup")}
          >
            <Text style={[styles.primaryButtonText, { color: theme.mode === "dark" ? theme.onPrimary : "#111111" }]}>Get Started</Text>
          </Pressable>

          <Pressable style={styles.signInButton} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.signInText}>I already have an account</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  screen: { flex: 1, overflow: "hidden", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  brand: { marginTop: spacing.base, textAlign: "center", color: "#ffffff", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  heroCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg },
  title: { textAlign: "center", color: "#ffffff", fontSize: 42, fontWeight: "800", lineHeight: 56, letterSpacing: -1.2 },
  illustrationWrap: { width: 170, height: 106, alignItems: "center", justifyContent: "center" },
  yellowBlob: { position: "absolute", width: 146, height: 74, borderRadius: 60, backgroundColor: "#FFD65A", transform: [{ rotate: "-10deg" }] },
  logo: { width: 96, height: 96 },
  plusBadge: { position: "absolute", top: 4, right: 16, width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: "#ffffff", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  plusText: { fontSize: 13, fontWeight: "900" },
  subtitle: { maxWidth: 260, textAlign: "center", color: "rgba(255,255,255,0.88)", ...typography.bodySm },
  footer: { gap: spacing.sm },
  primaryButton: { minHeight: 58, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  primaryButtonText: { fontSize: 14, fontWeight: "800" },
  signInButton: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  signInText: { color: "rgba(255,255,255,0.88)", fontSize: 13, fontWeight: "700" },
  orbitOne: { position: "absolute", top: 112, left: -32, width: 420, height: 420, borderRadius: 420, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  orbitTwo: { position: "absolute", top: 150, left: 12, width: 330, height: 330, borderRadius: 330, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" },
  orbitThree: { position: "absolute", top: 192, left: 54, width: 246, height: 246, borderRadius: 246, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
});
