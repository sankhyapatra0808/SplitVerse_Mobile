import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Screen from "../../src/components/Screen";
import SheetModal from "../../src/components/SheetModal";
import Text from "../../src/components/LocalizedText";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import { showErrorAlert } from "../../src/lib/errors";
import { signInWithGoogleAndGetIdToken } from "../../src/lib/googleAuth";
import { isValidEmailAddress } from "../../src/lib/validation";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

export default function Login() {
  const { theme } = useAppSettings();
  const {
    login,
    loginWithGoogleIdToken,
    startEmailLoginOtp,
    completeEmailLoginWithOtp,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpSessionId, setOtpSessionId] = useState("");
  const [otp, setOtp] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpPassword, setOtpPassword] = useState("");

  async function handleLogin() {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      Alert.alert("Email required", "Enter the email address linked to your SplitVerse account.");
      return;
    }

    if (!isValidEmailAddress(trimmedEmail)) {
      Alert.alert("Invalid email address", "Enter a complete email address, such as name@example.com.");
      return;
    }

    if (!password) {
      Alert.alert("Password required", "Enter your SplitVerse account password.");
      return;
    }

    try {
      setSubmitting(true);
      await login(trimmedEmail, password);
      router.replace("/(tabs)/dashboard");
    } catch (error) {
      showErrorAlert(error, {
        title: "Login failed",
        fallbackMessage: "SplitVerse could not sign you in. Check your details and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartOtpLogin() {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      Alert.alert(
        "Email and password required",
        "Enter email and password first, then request the email login code.",
      );
      return;
    }

    if (!isValidEmailAddress(trimmedEmail)) {
      Alert.alert("Invalid email address", "Enter a complete email address before requesting a login code.");
      return;
    }

    try {
      setOtpSubmitting(true);
      const session = await startEmailLoginOtp(trimmedEmail, password);
      setOtpSessionId(session.sessionId);
      setOtpEmail(trimmedEmail);
      setOtpPassword(password);
      setOtp("");
      Alert.alert(
        "Code sent",
        `A 6-digit login code was sent to ${session.email}.`,
      );
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not send login code",
        fallbackMessage: "The email login code could not be sent. Check your connection and try again.",
      });
    } finally {
      setOtpSubmitting(false);
    }
  }

  async function handleCompleteOtpLogin() {
    if (!otpSessionId || otp.length !== 6) {
      Alert.alert("Code required", "Enter the 6-digit login code.");
      return;
    }

    try {
      setOtpSubmitting(true);
      await completeEmailLoginWithOtp(otpEmail, otpPassword, otpSessionId, otp);
      setOtpSessionId("");
      setOtp("");
      router.replace("/(tabs)/dashboard");
    } catch (error) {
      showErrorAlert(error, {
        title: "Code verification failed",
        fallbackMessage: "The login code could not be verified. Request a new code and try again.",
      });
    } finally {
      setOtpSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setGoogleSubmitting(true);

      const idToken = await signInWithGoogleAndGetIdToken();
      await loginWithGoogleIdToken(idToken);

      router.replace("/(tabs)/dashboard");
    } catch (error) {
      showErrorAlert(error, {
        title: "Google sign-in failed",
        fallbackMessage: "Google sign-in could not be completed. Please try again.",
      });
    } finally {
      setGoogleSubmitting(false);
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
          title="Send email login code"
          variant="secondary"
          loading={otpSubmitting && !otpSessionId}
          onPress={handleStartOtpLogin}
        />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <Pressable
          style={[styles.googleButton, { backgroundColor: theme.mode === "dark" ? theme.primary : "#ffffff", borderColor: theme.mode === "dark" ? theme.primary : theme.borderSoft }]}
          onPress={handleGoogleLogin}
          disabled={googleSubmitting}
        >
          <Image source={require("../../assets/google-logo.png")} style={styles.googleLogo} resizeMode="contain" />
          <Text style={[styles.googleText, { color: theme.mode === "dark" ? theme.onPrimary : "#111111" }]}>
            {googleSubmitting ? "Signing in" : "Continue with Google"}
          </Text>
        </Pressable>

        <AppButton
          title="Create account"
          variant="secondary"
          onPress={() => router.push("/(auth)/signup")}
        />
      </AppCard>

      <SheetModal
        visible={Boolean(otpSessionId)}
        eyebrow="Email login code"
        title="Verify your login"
        onClose={() => {
          setOtpSessionId("");
          setOtp("");
        }}
      >
        <Text style={styles.otpCopy}>
          Enter the 6-digit code sent to {otpEmail}. The code expires in a few
          minutes.
        </Text>
        <AppTextInput
          label="Login code"
          value={otp}
          onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          placeholder="123456"
          editable={!otpSubmitting}
        />
        <AppButton
          title={otpSubmitting ? "Verifying" : "Verify and sign in"}
          loading={otpSubmitting}
          onPress={handleCompleteOtpLogin}
        />
      </SheetModal>
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
  otpCopy: {
    color: colors.body,
    ...typography.bodySm,
  },
});
