import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { AppError, getErrorPresentation } from "../../src/lib/errors";
import { signInWithGoogleAndGetIdToken } from "../../src/lib/googleAuth";
import {
  getLoginAttemptCount,
  recordFailedLoginAttempt,
  MAX_DAILY_LOGIN_ATTEMPTS,
} from "../../src/lib/loginAttemptGuard";
import { setPendingLoginOtp } from "../../src/lib/pendingLoginOtp";

const REMEMBER_LOGIN_KEY = "splitverse-auth-remember-login";

type ActiveAction = "send-code" | "google" | null;

function isInvalidCredentialError(error: unknown): boolean {
  if (error instanceof AppError) {
    if (error.status === 401) return true;
    return error.originalError
      ? isInvalidCredentialError(error.originalError)
      : false;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: unknown }).code).includes(
      "INVALID_LOGIN_CREDENTIALS",
    )
  );
}

export default function Login() {
  const { theme, t } = useAppSettings();
  const { loginWithGoogleIdToken, startEmailLoginOtp } = useAuth();

  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberFor30Days, setRememberFor30Days] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);

  const loading = activeAction !== null;

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(REMEMBER_LOGIN_KEY).then((value) => {
      if (active && value !== null) {
        setRememberFor30Days(value === "true");
      }
    });

    return () => {
      active = false;
    };
  }, []);

  function clearInlineError() {
    if (error) setError("");
  }

  async function persistRememberChoice(nextValue: boolean) {
    setRememberFor30Days(nextValue);
    await AsyncStorage.setItem(
      REMEMBER_LOGIN_KEY,
      nextValue ? "true" : "false",
    );
  }

  async function handleSendOtp() {
    Keyboard.dismiss();
    setError("");

    const identifier = email.trim().toLowerCase();

    if (!identifier) {
      setError("Enter your email address or username.");
      return;
    }

    const normalizedUsername = identifier.replace(/^@+/, "");
    const looksLikeEmail = identifier.includes("@");
    if (
      (!looksLikeEmail && !/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) ||
      (looksLikeEmail && !identifier.includes(".") && !identifier.startsWith("@"))
    ) {
      setError("Enter a valid email address or SplitVerse username.");
      return;
    }

    if (!password) {
      setError("Enter your SplitVerse account password.");
      return;
    }

    if (
      (await getLoginAttemptCount(identifier)) >= MAX_DAILY_LOGIN_ATTEMPTS
    ) {
      setError("Too many login attempts today. Please try again tomorrow.");
      return;
    }

    try {
      setActiveAction("send-code");

      await AsyncStorage.setItem(
        REMEMBER_LOGIN_KEY,
        rememberFor30Days ? "true" : "false",
      );

      const session = await startEmailLoginOtp(
        identifier,
        password,
        rememberFor30Days,
      );

      setPendingLoginOtp({
        email: session.email,
        remember: rememberFor30Days,
        sessionId: session.sessionId,
        destinationEmail: session.email,
      });
      setPassword("");

      router.push("/(auth)/verify-login-otp");
    } catch (loginError) {
      const presentation = getErrorPresentation(loginError, {
        title: "Could not send login code",
        fallbackMessage:
          "The email login code could not be sent. Check your details and try again.",
      });

      if (!isInvalidCredentialError(loginError)) {
        setError(presentation.message);
        return;
      }

      const attempts = await recordFailedLoginAttempt(identifier);
      const attemptsLeft = Math.max(0, MAX_DAILY_LOGIN_ATTEMPTS - attempts);

      setError(
        attemptsLeft > 0
          ? `${presentation.message} ${attemptsLeft} login attempt${
              attemptsLeft === 1 ? "" : "s"
            } left today.`
          : "Too many login attempts today. Please try again tomorrow.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleGoogleLogin() {
    Keyboard.dismiss();
    setError("");

    try {
      setActiveAction("google");

      await AsyncStorage.setItem(
        REMEMBER_LOGIN_KEY,
        rememberFor30Days ? "true" : "false",
      );

      const idToken = await signInWithGoogleAndGetIdToken();
      await loginWithGoogleIdToken(idToken, rememberFor30Days);
      router.replace("/(tabs)/dashboard");
    } catch (googleError) {
      const presentation = getErrorPresentation(googleError, {
        title: "Google sign-in failed",
        fallbackMessage:
          "Google sign-in could not be completed. Please try again.",
      });
      setError(presentation.message);
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <AuthFullscreenScaffold title="Login" layout="login">
      {({ palette, compact }) => (
        <View style={styles.formBody}>
          <View style={[styles.fields, compact && styles.fieldsCompact]}>
            <FloatingAuthField
              label={t("Email or username")}
              palette={palette}
              compact={compact}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                clearInlineError();
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              editable={!loading}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <FloatingAuthField
              ref={passwordRef}
              label={t("Password")}
              palette={palette}
              compact={compact}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                clearInlineError();
              }}
              secureTextEntry={!passwordVisible}
              textContentType="password"
              autoComplete="password"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={() => void handleSendOtp()}
              rightActionLabel={t("Forgot?")}
              onRightActionPress={() => {
                Keyboard.dismiss();
                router.push("/(auth)/forgot-password");
              }}
              rightIconName={
                passwordVisible ? "eye-off-outline" : "eye-outline"
              }
              rightIconAccessibilityLabel={
                passwordVisible ? "Hide password" : "Show password"
              }
              onRightIconPress={() => setPasswordVisible((current) => !current)}
            />
          </View>

          <View style={styles.optionsRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberFor30Days }}
              onPress={() => void persistRememberChoice(!rememberFor30Days)}
              disabled={loading}
              hitSlop={8}
              style={styles.rememberButton}
            >
              <Ionicons
                name={rememberFor30Days ? "checkbox-outline" : "square-outline"}
                size={18}
                color={rememberFor30Days ? theme.primary : palette.muted}
              />
              <NativeText
                allowFontScaling={false}
                style={[styles.optionText, { color: palette.muted }]}
              >
                Remember for 30 days
              </NativeText>
            </Pressable>

            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                router.push("/(auth)/terms-and-conditions");
              }}
              disabled={loading}
              hitSlop={8}
            >
              <NativeText
                allowFontScaling={false}
                style={[styles.termsText, { color: palette.text }]}
              >
                Terms & Conditions
              </NativeText>
            </Pressable>
          </View>

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
            onPress={() => void handleSendOtp()}
            disabled={loading}
          >
            {activeAction === "send-code" ? (
              <ActivityIndicator color={palette.buttonText} />
            ) : (
              <NativeText
                allowFontScaling={false}
                style={[
                  styles.primaryButtonText,
                  { color: palette.buttonText },
                ]}
              >
                {t("Send OTP")}
              </NativeText>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: palette.line }]} />
            <NativeText
              allowFontScaling={false}
              style={[styles.dividerText, { color: palette.muted }]}
            >
              {t("Or continue with")}
            </NativeText>
            <View style={[styles.divider, { backgroundColor: palette.line }]} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              compact && styles.googleButtonCompact,
              {
                backgroundColor: palette.google,
                borderColor: palette.googleBorder,
                opacity: loading ? 0.65 : pressed ? 0.88 : 1,
              },
            ]}
            onPress={() => void handleGoogleLogin()}
            disabled={loading}
          >
            {activeAction === "google" ? (
              <ActivityIndicator color={palette.text} />
            ) : (
              <>
                <Image
                  source={require("../../assets/google-logo.png")}
                  style={styles.googleLogo}
                  resizeMode="contain"
                />
                <NativeText
                  allowFontScaling={false}
                  style={[styles.googleText, { color: palette.text }]}
                >
                  Google
                </NativeText>
              </>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <NativeText
              allowFontScaling={false}
              style={[styles.footerText, { color: palette.muted }]}
            >
              {t("Don't have an account?")}{" "}
            </NativeText>
            <Pressable
              onPress={() => router.push("/(auth)/signup")}
              disabled={loading}
              hitSlop={8}
            >
              <NativeText
                allowFontScaling={false}
                style={[styles.footerLink, { color: palette.text }]}
              >
                {t("Create now")}
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
  fields: {
    gap: 8,
  },
  fieldsCompact: {
    gap: 4,
  },
  optionsRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 7,
  },
  rememberButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  optionText: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "500",
    includeFontPadding: true,
  },
  termsText: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
    includeFontPadding: true,
  },
  messageSlot: {
    minHeight: 31,
    justifyContent: "center",
    marginTop: 0,
    marginBottom: 3,
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
    overflow: "hidden",
  },
  primaryButtonCompact: {
    minHeight: 40,
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    includeFontPadding: false,

    textAlign: "center",
    textAlignVertical: "center",
    width: "100%",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 10,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "400",
    includeFontPadding: true,
  },
  googleButton: {
    width: "100%",
    minHeight: 44,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 4,
  },
  googleButtonCompact: {
    minHeight: 38,
  },
  googleLogo: {
    width: 18,
    height: 18,
  },
  googleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    includeFontPadding: true,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    paddingTop: 8,
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
