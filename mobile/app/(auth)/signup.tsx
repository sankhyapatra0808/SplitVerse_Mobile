import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function Signup() {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSignup() {
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    try {
      setSubmitting(true);
      await signup(email, password);
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

        <AppButton
          title="Create account"
          loading={submitting}
          onPress={handleSignup}
        />

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
});