import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Keyboard,
  Platform,
  StyleSheet,
  View,
  type KeyboardEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppButton from "../src/components/AppButton";
import AppTextInput from "../src/components/AppTextInput";
import Text from "../src/components/LocalizedText";
import { useAuth } from "../src/context/AuthContext";
import { useAppSettings } from "../src/context/useAppSettings";
import { checkUsernameAvailability, saveWalletPin } from "../src/lib/api";
import { showErrorAlert } from "../src/lib/errors";
import { radius, spacing, typography } from "../src/theme/tokens";

type FocusedField = "username" | "pin" | "confirm" | null;

const KEYBOARD_GAP = 14;

export default function WalletSecurityScreen() {
  const { user, dbUser, initializing, refreshDbUser } = useAuth();
  const { theme } = useAppSettings();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  const focusedFieldRef = useRef<FocusedField>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const confirmFieldRef = useRef<View>(null);
  const confirmShift = useRef(new Animated.Value(0)).current;
  const confirmShiftedRef = useRef(false);

  const requiresWalletSetup = Boolean(
    !initializing && user && dbUser && dbUser.has_wallet_pin === false,
  );
  const needsUsername = Boolean(requiresWalletSetup && !dbUser?.username);
  const normalizedUsername = username.trim().toLowerCase().replace(/^@+/, "");

  const canSave = useMemo(
    () =>
      /^\d{4,6}$/.test(pin) &&
      pin === confirmPin &&
      (!needsUsername || /^[a-z0-9_]{3,30}$/.test(normalizedUsername)),
    [confirmPin, needsUsername, normalizedUsername, pin],
  );

  function restoreConfirmField(animated = true) {
    confirmShiftedRef.current = false;
    Animated.timing(confirmShift, {
      toValue: 0,
      duration: animated ? 180 : 0,
      useNativeDriver: true,
    }).start();
  }

  function liftConfirmFieldAboveKeyboard(keyboardTop: number) {
    // Do not keep re-measuring an already translated field. The shift is
    // calculated once per keyboard appearance and reset when the keyboard
    // closes, so the page itself never changes position.
    if (confirmShiftedRef.current) return;

    requestAnimationFrame(() => {
      confirmFieldRef.current?.measureInWindow((_x, y, _width, height) => {
        const confirmBottom = y + height;
        const overlap = confirmBottom + KEYBOARD_GAP - keyboardTop;

        if (overlap <= 0) {
          restoreConfirmField(false);
          return;
        }

        confirmShiftedRef.current = true;
        Animated.timing(confirmShift, {
          toValue: -overlap,
          duration: 190,
          useNativeDriver: true,
        }).start();
      });
    });
  }

  function handleFieldFocus(field: FocusedField) {
    focusedFieldRef.current = field;

    if (field === "username") {
      // If the user moves back from the PIN fields while the keyboard remains
      // open, return Confirm PIN to its normal position immediately.
      restoreConfirmField();
      return;
    }

    if ((field === "pin" || field === "confirm") && keyboardTopRef.current) {
      liftConfirmFieldAboveKeyboard(keyboardTopRef.current);
    }
  }

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      router.replace("/");
      return;
    }

    if (dbUser && dbUser.has_wallet_pin !== false) {
      router.replace("/(tabs)/dashboard");
    }
  }, [dbUser, initializing, user]);

  useEffect(() => {
    if (!requiresWalletSetup) return;

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );

    return () => backSubscription.remove();
  }, [requiresWalletSetup]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(
      showEvent,
      (event: KeyboardEvent) => {
        keyboardTopRef.current = event.endCoordinates.screenY;

        if (
          focusedFieldRef.current === "pin" ||
          focusedFieldRef.current === "confirm"
        ) {
          // Only Confirm PIN is translated. The hero, username, Wallet PIN,
          // card and rest of the page remain exactly where they were.
          setTimeout(
            () => liftConfirmFieldAboveKeyboard(event.endCoordinates.screenY),
            Platform.OS === "ios" ? 35 : 20,
          );
        }
      },
    );

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardTopRef.current = null;
      focusedFieldRef.current = null;
      restoreConfirmField();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [confirmShift]);

  async function handleSavePin() {
    if (!/^\d{4,6}$/.test(pin)) {
      Alert.alert("Invalid PIN", "Enter a 4 to 6 digit wallet PIN.");
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert("PIN mismatch", "Both wallet PIN fields must match.");
      return;
    }

    if (needsUsername && !/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      Alert.alert(
        "Invalid username",
        "Use 3 to 30 lowercase letters, numbers, or underscores.",
      );
      return;
    }

    try {
      setSaving(true);

      if (needsUsername) {
        const availability = await checkUsernameAvailability(normalizedUsername);
        if (!availability.available) {
          Alert.alert("Username unavailable", "That username is already taken.");
          return;
        }
      }

      await saveWalletPin({
        pin,
        ...(needsUsername ? { username: normalizedUsername } : {}),
      });

      Keyboard.dismiss();
      restoreConfirmField(false);
      setUsername("");
      setPin("");
      setConfirmPin("");
      await refreshDbUser();
      router.replace("/(tabs)/dashboard");
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not save wallet PIN",
        fallbackMessage:
          "Your wallet PIN was not saved. Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (initializing || !user || !dbUser || !requiresWalletSetup) {
    return (
      <SafeAreaView
        style={[styles.loadingScreen, { backgroundColor: theme.background }]}
      >
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />

      {/*
       * Intentionally not wrapped in KeyboardAvoidingView/ScrollView.
       * The page stays fixed and non-scrollable when the keyboard appears.
       * Only the Confirm PIN field is translated when it would be covered.
       */}
      <View style={styles.pageContent}>
        <View style={styles.hero}>
          <View
            style={[styles.iconWrap, { backgroundColor: theme.primarySoft }]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={34}
              color={theme.primary}
            />
          </View>

          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>
              WALLET SECURITY
            </Text>
            <Text style={[styles.title, { color: theme.text }]}>
              {needsUsername ? "Complete your setup" : "Set your wallet PIN"}
            </Text>
            <Text style={[styles.subtitle, { color: theme.body }]}>
              {needsUsername
                ? "Choose your permanent unique username and secure your wallet with a PIN."
                : "Create a wallet PIN before using SplitVerse payments."}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.formCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {needsUsername ? (
            <AppTextInput
              label="Unique username"
              value={username}
              onChangeText={(value) =>
                setUsername(
                  value
                    .toLowerCase()
                    .replace(/^@+/, "")
                    .replace(/[^a-z0-9_]/g, "")
                    .slice(0, 30),
                )
              }
              onFocus={() => handleFieldFocus("username")}
              onBlur={() => {
                if (focusedFieldRef.current === "username") {
                  focusedFieldRef.current = null;
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="your_username"
              editable={!saving}
              returnKeyType="next"
            />
          ) : null}

          <AppTextInput
            label="Wallet PIN"
            value={pin}
            onChangeText={(value) =>
              setPin(value.replace(/\D/g, "").slice(0, 6))
            }
            onFocus={() => handleFieldFocus("pin")}
            onBlur={() => {
              if (focusedFieldRef.current === "pin") {
                focusedFieldRef.current = null;
              }
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            secureTextEntry
            placeholder="4 to 6 digits"
            editable={!saving}
            maxLength={6}
          />

          <Animated.View
            ref={confirmFieldRef}
            collapsable={false}
            style={{ transform: [{ translateY: confirmShift }] }}
          >
            <AppTextInput
              label="Confirm PIN"
              value={confirmPin}
              onChangeText={(value) =>
                setConfirmPin(value.replace(/\D/g, "").slice(0, 6))
              }
              onFocus={() => handleFieldFocus("confirm")}
              onBlur={() => {
                if (focusedFieldRef.current === "confirm") {
                  focusedFieldRef.current = null;
                }
              }}
              keyboardType="number-pad"
              inputMode="numeric"
              secureTextEntry
              placeholder="Re-enter PIN"
              editable={!saving}
              maxLength={6}
            />
          </Animated.View>

          <AppButton
            title={
              saving
                ? "Saving"
                : needsUsername
                  ? "Complete setup"
                  : "Save wallet PIN"
            }
            loading={saving}
            disabled={!canSave || saving}
            onPress={handleSavePin}
            style={styles.completeButton}
          />

          <Text style={[styles.securityNote, { color: theme.muted }]}>
            Your wallet PIN is required for protected wallet actions. Keep it
            private and do not share it with anyone.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    gap: spacing.base,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.caption,
    letterSpacing: 1.2,
  },
  title: {
    ...typography.titleMd,
    fontSize: 28,
    lineHeight: 35,
  },
  subtitle: {
    ...typography.bodySm,
    lineHeight: 21,
    maxWidth: 560,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.base,
  },
  completeButton: {
    marginTop: spacing.xs,
  },
  securityNote: {
    ...typography.caption,
    lineHeight: 18,
    textAlign: "center",
  },
});
