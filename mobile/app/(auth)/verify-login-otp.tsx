import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
} from "react-native";
import {
  AuthFullscreenScaffold,
  FloatingAuthField,
} from "../../src/components/AuthFullscreenScaffold";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import { getErrorPresentation } from "../../src/lib/errors";
import { clearLoginAttempts } from "../../src/lib/loginAttemptGuard";
import {
  clearPendingLoginOtp,
  getPendingLoginOtp,
  setPendingLoginOtp,
} from "../../src/lib/pendingLoginOtp";

type ActiveAction = "verify" | "resend" | null;

export default function VerifyLoginOtp() {
  const { theme } = useAppSettings();
  const { completeEmailLoginWithOtp, resendEmailLoginOtp } = useAuth();

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [challenge, setChallenge] = useState(getPendingLoginOtp());

  const loading = activeAction !== null;

  useEffect(() => {
    if (!challenge) {
      router.replace("/(auth)/login");
    }
  }, [challenge]);

  if (!challenge) return null;

  async function handleVerifyOtp() {
    const activeChallenge = challenge;
    if (!activeChallenge) return;

    const sanitizedOtp = otp.replace(/\D/g, "");
    setError("");
    setStatus("");

    if (sanitizedOtp.length !== 6) {
      setError("Enter the 6-digit login code sent to your email.");
      return;
    }

    try {
      setActiveAction("verify");

      await completeEmailLoginWithOtp(
        activeChallenge.sessionId,
        sanitizedOtp,
        activeChallenge.remember,
      );

      await clearLoginAttempts(activeChallenge.email);
      clearPendingLoginOtp();
      router.replace("/(tabs)/dashboard");
    } catch (verificationError) {
      const presentation = getErrorPresentation(verificationError, {
        title: "Code verification failed",
        fallbackMessage:
          "The login code could not be verified. Request a new code and try again.",
      });
      setError(presentation.message);
    } finally {
      setActiveAction(null);
    }
  }

  async function handleResendOtp() {
    const activeChallenge = challenge;
    if (!activeChallenge) return;

    setError("");
    setStatus("");

    try {
      setActiveAction("resend");

      const session = await resendEmailLoginOtp(activeChallenge.sessionId);

      const nextChallenge = {
        ...activeChallenge,
        sessionId: session.sessionId,
        destinationEmail: session.email,
      };

      setPendingLoginOtp(nextChallenge);
      setChallenge(nextChallenge);
      setOtp("");
      setStatus(`A new 6-digit code was sent to ${session.email}.`);
    } catch (resendError) {
      const presentation = getErrorPresentation(resendError, {
        title: "Could not resend login code",
        fallbackMessage:
          "A new login code could not be sent. Check your connection and try again.",
      });
      setError(presentation.message);
    } finally {
      setActiveAction(null);
    }
  }

  function handleChangeEmail() {
    clearPendingLoginOtp();
    router.replace("/(auth)/login");
  }

  return (
    <AuthFullscreenScaffold title="Enter OTP">
      {({ palette, compact }) => (
        <View style={styles.formBody}>
          <NativeText
            allowFontScaling={false}
            style={[styles.instructions, { color: palette.muted }]}
          >
            Enter the 6-digit code sent to {challenge.destinationEmail}.
          </NativeText>

          <FloatingAuthField
            label="One-time password"
            palette={palette}
            compact={compact}
            value={otp}
            onChangeText={(value) => {
              setOtp(value.replace(/\D/g, "").slice(0, 6));
              if (error) setError("");
              if (status) setStatus("");
            }}
            autoFocus
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            editable={!loading}
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={() => void handleVerifyOtp()}
          />

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
                numberOfLines={3}
              >
                {status}
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
            onPress={() => void handleVerifyOtp()}
            disabled={loading}
          >
            {activeAction === "verify" ? (
              <ActivityIndicator color={palette.buttonText} />
            ) : (
              <NativeText
                allowFontScaling={false}
                style={[
                  styles.primaryButtonText,
                  { color: palette.buttonText },
                ]}
              >
                Take me to my dashboard
              </NativeText>
            )}
          </Pressable>

          <View style={styles.otpActions}>
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
                  Resend code
                </NativeText>
              )}
            </Pressable>

            <Pressable
              onPress={handleChangeEmail}
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

          <NativeText
            allowFontScaling={false}
            style={[styles.expiryText, { color: palette.muted }]}
          >
            The code expires in a few minutes.
          </NativeText>
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
    textAlign: "center",
    marginBottom: 14,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "400",
    includeFontPadding: true,
  },
  messageSlot: {
    minHeight: 38,
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  inlineMessage: {
    textAlign: "center",
    fontSize: 9,
    lineHeight: 15,
    fontWeight: "500",
    includeFontPadding: true,
  },
  primaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    paddingHorizontal: 14,
  },
  primaryButtonCompact: {
    minHeight: 38,
  },
  primaryButtonText: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 18,
    fontWeight: "600",
    includeFontPadding: true,
  },
  otpActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  actionText: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "700",
    includeFontPadding: true,
  },
  expiryText: {
    textAlign: "center",
    marginTop: "auto",
    fontSize: 9,
    lineHeight: 15,
    fontWeight: "400",
    includeFontPadding: true,
  },
});
