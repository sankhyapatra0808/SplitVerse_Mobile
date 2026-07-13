import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
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

type ActiveAction = "reset" | "resend" | null;

export default function ResetPassword() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const { theme } = useAppSettings();
  const { requestPasswordResetOtp, resetPasswordWithOtp } = useAuth();

  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const email = useMemo(() => {
    const rawEmail = Array.isArray(params.email) ? params.email[0] : params.email;
    return String(rawEmail || "").trim().toLowerCase();
  }, [params.email]);

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [completed, setCompleted] = useState(false);

  const loading = activeAction !== null;

  async function handleResetPassword() {
    Keyboard.dismiss();
    setError("");
    setStatus("");

    const sanitizedOtp = otp.replace(/\D/g, "");

    if (!email) {
      setError("Your reset email is missing. Request a new password reset code.");
      return;
    }

    if (sanitizedOtp.length !== 6) {
      setError("Enter the 6-digit password reset code sent to your email.");
      return;
    }

    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      newPasswordRef.current?.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match.");
      confirmPasswordRef.current?.focus();
      return;
    }

    try {
      setActiveAction("reset");
      const response = await resetPasswordWithOtp({
        email,
        otp: sanitizedOtp,
        password: newPassword,
        confirmPassword,
      });

      setCompleted(true);
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus(
        response.message ||
          "Password changed successfully. You can now sign in with your new password.",
      );
    } catch (resetError) {
      const presentation = getErrorPresentation(resetError, {
        title: "Password reset failed",
        fallbackMessage:
          "The password could not be reset. Check the OTP and try again.",
      });
      setError(presentation.message);
    } finally {
      setActiveAction(null);
    }
  }

  async function handleResendOtp() {
    if (!email) {
      router.replace("/(auth)/forgot-password");
      return;
    }

    Keyboard.dismiss();
    setError("");
    setStatus("");

    try {
      setActiveAction("resend");
      const response = await requestPasswordResetOtp(email);
      setOtp("");
      setStatus(
        response.message || `A new password reset code was sent to ${email}.`,
      );
    } catch (resendError) {
      const presentation = getErrorPresentation(resendError, {
        title: "Could not resend reset code",
        fallbackMessage:
          "A new password reset code could not be sent. Check your connection and try again.",
      });
      setError(presentation.message);
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <AuthFullscreenScaffold title="Reset password">
      {({ palette, compact }) => (
        <View style={styles.formBody}>
          <NativeText
            allowFontScaling={false}
            style={[styles.instructions, { color: palette.muted }]}
            numberOfLines={3}
          >
            {email
              ? `Enter the code sent to ${email}, then set your new password.`
              : "Request a fresh password reset code from the login page."}
          </NativeText>

          {!completed ? (
            <View style={[styles.fields, compact && styles.fieldsCompact]}>
              <FloatingAuthField
                label="Reset OTP"
                palette={palette}
                compact={compact}
                value={otp}
                onChangeText={(value) => {
                  setOtp(value.replace(/\D/g, "").slice(0, 6));
                  if (error) setError("");
                  if (status) setStatus("");
                }}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                editable={!loading && Boolean(email)}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => newPasswordRef.current?.focus()}
              />

              <FloatingAuthField
                ref={newPasswordRef}
                label="New password"
                palette={palette}
                compact={compact}
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  if (error) setError("");
                  if (status) setStatus("");
                }}
                secureTextEntry={!newPasswordVisible}
                textContentType="newPassword"
                autoComplete="new-password"
                editable={!loading && Boolean(email)}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                rightIconName={
                  newPasswordVisible ? "eye-off-outline" : "eye-outline"
                }
                rightIconAccessibilityLabel={
                  newPasswordVisible ? "Hide new password" : "Show new password"
                }
                onRightIconPress={() =>
                  setNewPasswordVisible((current) => !current)
                }
              />

              <FloatingAuthField
                ref={confirmPasswordRef}
                label="Confirm new password"
                palette={palette}
                compact={compact}
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  if (error) setError("");
                  if (status) setStatus("");
                }}
                secureTextEntry={!confirmPasswordVisible}
                textContentType="newPassword"
                autoComplete="new-password"
                editable={!loading && Boolean(email)}
                returnKeyType="done"
                onSubmitEditing={() => void handleResetPassword()}
                rightIconName={
                  confirmPasswordVisible ? "eye-off-outline" : "eye-outline"
                }
                rightIconAccessibilityLabel={
                  confirmPasswordVisible
                    ? "Hide confirmed password"
                    : "Show confirmed password"
                }
                onRightIconPress={() =>
                  setConfirmPasswordVisible((current) => !current)
                }
              />
            </View>
          ) : null}

          <View style={styles.messageSlot}>
            {error ? (
              <NativeText
                allowFontScaling={false}
                style={[styles.inlineMessage, { color: theme.danger }]}
                numberOfLines={3}
              >
                {error}
              </NativeText>
            ) : status ? (
              <NativeText
                allowFontScaling={false}
                style={[styles.inlineMessage, { color: theme.primary }]}
                numberOfLines={4}
              >
                {status}
              </NativeText>
            ) : null}
          </View>

          {completed ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: palette.button,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              onPress={() => router.replace("/(auth)/login")}
            >
              <NativeText
                allowFontScaling={false}
                style={[
                  styles.primaryButtonText,
                  { color: palette.buttonText },
                ]}
              >
                Go to login
              </NativeText>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                compact && styles.primaryButtonCompact,
                {
                  backgroundColor: palette.button,
                  opacity: loading ? 0.68 : pressed ? 0.9 : 1,
                },
              ]}
              onPress={() => void handleResetPassword()}
              disabled={loading || !email}
            >
              {activeAction === "reset" ? (
                <ActivityIndicator color={palette.buttonText} />
              ) : (
                <NativeText
                  allowFontScaling={false}
                  style={[
                    styles.primaryButtonText,
                    { color: palette.buttonText },
                  ]}
                >
                  Update password
                </NativeText>
              )}
            </Pressable>
          )}

          {!completed ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => void handleResendOtp()}
                disabled={loading}
                hitSlop={8}
              >
                {activeAction === "resend" ? (
                  <ActivityIndicator color={palette.text} size="small" />
                ) : (
                  <NativeText
                    allowFontScaling={false}
                    style={[styles.actionText, { color: palette.text }]}
                  >
                    Resend OTP
                  </NativeText>
                )}
              </Pressable>

              <Pressable
                onPress={() => router.replace("/(auth)/forgot-password")}
                disabled={loading}
                hitSlop={8}
              >
                <NativeText
                  allowFontScaling={false}
                  style={[styles.actionText, { color: palette.text }]}
                >
                  Change email
                </NativeText>
              </Pressable>
            </View>
          ) : null}
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
    marginBottom: 8,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "400",
    includeFontPadding: true,
  },
  fields: {
    gap: 2,
  },
  fieldsCompact: {
    gap: 0,
  },
  messageSlot: {
    minHeight: 42,
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 3,
  },
  inlineMessage: {
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: 12,
  },
  actionText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    includeFontPadding: true,
  },
});
