import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
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
import { getErrorPresentation } from "../../src/lib/errors";
import { signInWithGoogleAndGetIdToken } from "../../src/lib/googleAuth";
import { isValidEmailAddress } from "../../src/lib/validation";
import { setPendingLoginOtp } from "../../src/lib/pendingLoginOtp";

type ActiveAction = "email" | "google" | null;

function getPasswordStrength(password: string) {
  let score = 0;

  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (!password) return { label: "Password strength", score: 0 };
  if (score <= 2) return { label: "Weak password", score };
  if (score <= 4) return { label: "Good password", score };
  return { label: "Strong password", score };
}

export default function Signup() {
  const { theme, t } = useAppSettings();
  const { signup, loginWithGoogleIdToken } = useAuth();

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const keyboardVisibleRef = useRef(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);

  const passwordStrength = getPasswordStrength(password);
  const loading = activeAction !== null;

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        keyboardVisibleRef.current = true;
      },
    );

    const keyboardHideSubscription = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        keyboardVisibleRef.current = false;
      },
    );

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (keyboardVisibleRef.current) {
          Keyboard.dismiss();
          return true;
        }

        router.replace("/");
        return true;
      },
    );

    return () => {
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
      backSubscription.remove();
    };
  }, []);

  function clearInlineError() {
    if (error) setError("");
  }

  function requireTermsAcceptance() {
    if (termsAccepted) return true;

    setError("Accept the Terms & Conditions before creating your account.");
    return false;
  }

  async function handleSignup() {
    Keyboard.dismiss();
    setError("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Enter your full name.");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Your full name must contain at least 2 characters.");
      return;
    }

    if (!trimmedEmail) {
      setError("Enter an email address for your SplitVerse account.");
      return;
    }

    if (!isValidEmailAddress(trimmedEmail)) {
      setError("Enter a complete email address, such as name@example.com.");
      return;
    }

    if (!password) {
      setError("Create a password for your SplitVerse account.");
      return;
    }

    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }

    if (!confirmPassword) {
      setError("Confirm your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The password and confirmation do not match.");
      return;
    }

    if (!requireTermsAcceptance()) return;

    try {
      setActiveAction("email");
      const session = await signup(trimmedEmail, password, trimmedName);
      setPendingLoginOtp({
        email: trimmedEmail,
        remember: true,
        sessionId: session.sessionId,
        destinationEmail: session.email,
      });
      setPassword("");
      setConfirmPassword("");
      router.replace("/(auth)/verify-login-otp");
    } catch (signupError) {
      const presentation = getErrorPresentation(signupError, {
        title: "Account creation failed",
        fallbackMessage:
          "SplitVerse could not create your account. Check your details and try again.",
      });
      setError(presentation.message);
    } finally {
      setActiveAction(null);
    }
  }

  async function handleGoogleSignup() {
    Keyboard.dismiss();
    setError("");

    if (!requireTermsAcceptance()) return;

    try {
      setActiveAction("google");
      const idToken = await signInWithGoogleAndGetIdToken();
      await loginWithGoogleIdToken(idToken, true);
      router.replace("/(tabs)/dashboard");
    } catch (signupError) {
      const presentation = getErrorPresentation(signupError, {
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
    <AuthFullscreenScaffold title="Sign up" layout="signup">
      {({ palette }) => {
        const dense = true;

        return (
          <View style={styles.formBody}>
            <View style={styles.fields}>
              <FloatingAuthField
                label={t("Full name")}
                palette={palette}
                compact={dense}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  clearInlineError();
                }}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                autoComplete="name"
                editable={!loading}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
              />

              <FloatingAuthField
                ref={emailRef}
                label={t("Email")}
                palette={palette}
                compact={dense}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  clearInlineError();
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                editable={!loading}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              <FloatingAuthField
                ref={passwordRef}
                label={t("Password")}
                palette={palette}
                compact={dense}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  clearInlineError();
                }}
                secureTextEntry={!passwordVisible}
                textContentType="newPassword"
                autoComplete="new-password"
                editable={!loading}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                rightIconName={
                  passwordVisible ? "eye-off-outline" : "eye-outline"
                }
                rightIconAccessibilityLabel={
                  passwordVisible ? "Hide password" : "Show password"
                }
                onRightIconPress={() =>
                  setPasswordVisible((current) => !current)
                }
              />

              <FloatingAuthField
                ref={confirmPasswordRef}
                label={t("Confirm password")}
                palette={palette}
                compact={dense}
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  clearInlineError();
                }}
                secureTextEntry={!confirmPasswordVisible}
                textContentType="newPassword"
                autoComplete="new-password"
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={() => void handleSignup()}
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

            <View style={styles.strengthRow}>
              <View
                style={[
                  styles.strengthTrack,
                  { backgroundColor: palette.line },
                ]}
              >
                {passwordStrength.score > 0 ? (
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${passwordStrength.score * 20}%`,
                        backgroundColor: theme.primary,
                      },
                    ]}
                  />
                ) : null}
              </View>

              <NativeText
                allowFontScaling={false}
                style={[styles.strengthText, { color: palette.muted }]}
              >
                {passwordStrength.label}
              </NativeText>
            </View>

            <View style={styles.termsRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: termsAccepted }}
                onPress={() => {
                  setTermsAccepted((current) => !current);
                  clearInlineError();
                }}
                disabled={loading}
                hitSlop={8}
                style={styles.termsCheckbox}
              >
                <Ionicons
                  name={termsAccepted ? "checkbox-outline" : "square-outline"}
                  size={18}
                  color={termsAccepted ? theme.primary : palette.muted}
                />
                <NativeText
                  allowFontScaling={false}
                  style={[styles.termsCopy, { color: palette.muted }]}
                >
                  I agree to the
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
                  style={[styles.termsLink, { color: palette.text }]}
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
                dense && styles.primaryButtonCompact,
                {
                  backgroundColor: palette.button,
                  opacity: loading ? 0.68 : pressed ? 0.9 : 1,
                },
              ]}
              onPress={() => void handleSignup()}
              disabled={loading}
            >
              {activeAction === "email" ? (
                <ActivityIndicator color={palette.buttonText} />
              ) : (
                <NativeText
                  allowFontScaling={false}
                  style={[
                    styles.primaryButtonText,
                    { color: palette.buttonText },
                  ]}
                >
                  {t("Create account")}
                </NativeText>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View
                style={[styles.divider, { backgroundColor: palette.line }]}
              />
              <NativeText
                allowFontScaling={false}
                style={[styles.dividerText, { color: palette.muted }]}
              >
                {t("Or continue with")}
              </NativeText>
              <View
                style={[styles.divider, { backgroundColor: palette.line }]}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                dense && styles.googleButtonCompact,
                {
                  backgroundColor: palette.google,
                  borderColor: palette.googleBorder,
                  opacity: loading ? 0.65 : pressed ? 0.88 : 1,
                },
              ]}
              onPress={() => void handleGoogleSignup()}
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
                {t("Already have an account?")}{" "}
              </NativeText>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  router.replace("/(auth)/login");
                }}
                disabled={loading}
                hitSlop={8}
              >
                <NativeText
                  allowFontScaling={false}
                  style={[styles.footerLink, { color: palette.text }]}
                >
                  {t("Log in")}
                </NativeText>
              </Pressable>
            </View>
          </View>
        );
      }}
    </AuthFullscreenScaffold>
  );
}

const styles = StyleSheet.create({
  formBody: {
    flex: 1,
  },
  fields: {
    gap: 0,
  },
  strengthRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 4,
  },
  strengthTrack: {
    flex: 1,
    height: 4,
    overflow: "hidden",
    borderRadius: 999,
  },
  strengthFill: {
    height: "100%",
    borderRadius: 999,
  },
  strengthText: {
    minWidth: 88,
    textAlign: "right",
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "500",
    includeFontPadding: true,
  },
  termsRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  termsCheckbox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  termsCopy: {
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "500",
    includeFontPadding: true,
  },
  termsLink: {
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
    includeFontPadding: true,
  },
  messageSlot: {
    minHeight: 28,
    justifyContent: "center",
  },
  inlineError: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "500",
    includeFontPadding: true,
  },
  primaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    overflow: "hidden",
  },
  primaryButtonCompact: {
    minHeight: 38,
  },
  primaryButtonText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    includeFontPadding: false,

    textAlign: "center",
    textAlignVertical: "center",
    width: "100%",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 8,
    marginBottom: 8,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "400",
    includeFontPadding: true,
  },
  googleButton: {
    width: "100%",
    minHeight: 40,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 4,
  },
  googleButtonCompact: {
    minHeight: 36,
  },
  googleLogo: {
    width: 17,
    height: 17,
  },
  googleText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    includeFontPadding: true,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "500",
    includeFontPadding: true,
  },
  footerLink: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    includeFontPadding: true,
  },
});
