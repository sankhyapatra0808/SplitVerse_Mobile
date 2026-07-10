import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Screen from "../../src/components/Screen";
import Text from "../../src/components/LocalizedText";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import { signInWithGoogleAndGetIdToken } from "../../src/lib/googleAuth";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (!password) return { label: "Password strength", score };
  if (score <= 2) return { label: "Weak password", score };
  if (score <= 4) return { label: "Good password", score };
  return { label: "Strong password", score };
}

export default function Signup() {
  const { theme } = useAppSettings();
  const { signup, loginWithGoogleIdToken } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const strength = getPasswordStrength(password);

  async function handleSignup() {
    if (!name.trim()) {
      Alert.alert("Name required", "Enter your name.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    try {
      setSubmitting(true);
      await signup(email, password, name);
      router.replace("/(tabs)/dashboard");
    } catch (error) {
      Alert.alert(
        "Signup failed",
        error instanceof Error ? error.message : "Could not create account",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignup() {
    try {
      setGoogleSubmitting(true);

      const idToken = await signInWithGoogleAndGetIdToken();
      await loginWithGoogleIdToken(idToken);

      router.replace("/(tabs)/dashboard");
    } catch (error) {
      Alert.alert(
        "Google sign-in failed",
        error instanceof Error
          ? error.message
          : "Could not continue with Google",
      );
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Start splitting fairly</Text>
        <Text style={styles.title}>Create your SplitVerse account</Text>
        <Text style={styles.subtitle}>
          Build rooms, add friends, assign items, and settle dues from mobile.
        </Text>
      </View>

      <AppCard style={styles.card}>
        <AppTextInput
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="Your name"
        />

        <AppTextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
        />

        <AppTextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 6 characters"
        />

        <View style={styles.strengthTrack}>
          {strength.score > 0 ? (
            <View
              style={[
                styles.strengthFill,
                { width: `${strength.score * 20}%`, backgroundColor: theme.primary },
              ]}
            />
          ) : null}
        </View>
        <Text style={styles.strengthText}>{strength.label}</Text>

        <AppButton
          title="Create account"
          loading={submitting}
          onPress={handleSignup}
        />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <Pressable
          style={[styles.googleButton, { backgroundColor: theme.mode === "dark" ? theme.primary : "#ffffff", borderColor: theme.mode === "dark" ? theme.primary : theme.borderSoft }]}
          onPress={handleGoogleSignup}
          disabled={googleSubmitting}
        >
          <Image source={require("../../assets/google-logo.png")} style={styles.googleLogo} resizeMode="contain" />
          <Text style={[styles.googleText, { color: theme.mode === "dark" ? theme.onPrimary : "#111111" }]}>
            {googleSubmitting ? "Signing up" : "Continue with Google"}
          </Text>
        </Pressable>

        <AppButton
          title="Already have an account?"
          variant="secondary"
          onPress={() => router.push("/(auth)/login")}
        />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingTop: spacing.xxl,
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
    ...typography.body,
  },
  card: {
    gap: spacing.base,
    marginTop: spacing.xl,
  },
  strengthTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.surfaceStrong,
  },
  strengthFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  strengthText: {
    marginTop: -spacing.sm,
    color: colors.body,
    ...typography.caption,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairlineSoft,
  },
  dividerText: {
    color: colors.body,
    ...typography.caption,
  },
  googleButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.pill,
    backgroundColor: colors.canvas,
  },
  googleLogo: {
    width: 22,
    height: 22,
  },
  googleText: {
    color: colors.ink,
    ...typography.button,
  },
});
