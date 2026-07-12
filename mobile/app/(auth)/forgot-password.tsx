import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
} from "react-native";
import {
  AuthFullscreenScaffold,
  FloatingAuthField,
} from "../../src/components/AuthFullscreenScaffold";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import { getErrorPresentation } from "../../src/lib/errors";
import { isValidEmailAddress } from "../../src/lib/validation";

export default function ForgotPassword() {
  const { theme } = useAppSettings();
  const { requestPasswordResetOtp } = useAuth();
  const emailRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendResetOtp() {
    Keyboard.dismiss();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Enter the email address linked to your SplitVerse account.");
      emailRef.current?.focus();
      return;
    }

    if (!isValidEmailAddress(trimmedEmail)) {
      setError("Enter a complete email address, such as name@example.com.");
      emailRef.current?.focus();
      return;
    }

    try {
      setLoading(true);
      await requestPasswordResetOtp(trimmedEmail);

      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: trimmedEmail },
      });
    } catch (requestError) {
      const presentation = getErrorPresentation(requestError, {
        title: "Could not send reset code",
        fallbackMessage:
          "The password reset code could not be sent. Check your connection and try again.",
      });
      setError(presentation.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFullscreenScaffold title="Forgot password">
      {({ palette, compact }) => (
        <View style={styles.formBody}>
          <NativeText
            allowFontScaling={false}
            style={[styles.instructions, { color: palette.muted }]}
          >
            Enter your registered email. We will send a 6-digit password
            reset code to your inbox.
          </NativeText>

          <FloatingAuthField
            ref={emailRef}
            label="Email"
            palette={palette}
            compact={compact}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (error) setError("");
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={() => void handleSendResetOtp()}
          />

          <View style={styles.messageSlot}>
            {error ? (
              <NativeText
                allowFontScaling={false}
                style={[styles.inlineError, { color: theme.danger }]}
                numberOfLines={3}
              >
                {error}
              </NativeText>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              compact && styles.primaryButtonCompact,
              {
                backgroundColor: palette.button,
                opacity: loading ? 0.68 : pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => void handleSendResetOtp()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={palette.buttonText} />
            ) : (
              <NativeText
                allowFontScaling={false}
                style={[
                  styles.primaryButtonText,
                  { color: palette.buttonText },
                ]}
              >
                Send reset OTP
              </NativeText>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <NativeText
              allowFontScaling={false}
              style={[styles.footerText, { color: palette.muted }]}
            >
              Remembered your password?{" "}
            </NativeText>
            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              disabled={loading}
              hitSlop={8}
            >
              <NativeText
                allowFontScaling={false}
                style={[styles.footerLink, { color: palette.text }]}
              >
                Back to login
              </NativeText>
            </Pressable>
          </View>
        </View>
      )}
    </AuthFullscreenScaffold>
  );
}

const styles = StyleSheet.create({
  formBody: {
    flex: 1,
  },
  instructions: {
    marginBottom: 18,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "400",
    includeFontPadding: true,
  },
  messageSlot: {
    minHeight: 42,
    justifyContent: "center",
    marginBottom: 4,
  },
  inlineError: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
    includeFontPadding: true,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  primaryButtonCompact: {
    minHeight: 40,
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    includeFontPadding: true,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    paddingTop: 12,
  },
  footerText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "400",
    includeFontPadding: true,
  },
  footerLink: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    includeFontPadding: true,
  },
});
