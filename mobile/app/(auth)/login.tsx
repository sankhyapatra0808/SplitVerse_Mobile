import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    try {
      setSubmitting(true);
      await login(email, password);
      router.replace("/(tabs)/dashboard");
    } catch (error) {
      Alert.alert(
        "Login failed",
        error instanceof Error ? error.message : "Could not login",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Welcome back</Text>
        <Text style={styles.title}>Sign in to SplitVerse</Text>
        <Text style={styles.subtitle}>
          Continue tracking fair item-wise splits and wallet settlements.
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
          placeholder="Your password"
        />

        <AppButton title="Sign in" loading={submitting} onPress={handleLogin} />

        <AppButton
          title="Create account"
          variant="secondary"
          onPress={() => router.push("/(auth)/signup")}
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