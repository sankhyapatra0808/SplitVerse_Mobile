import { useMemo, useState } from "react";
import { Alert, Modal, StyleSheet, View } from "react-native";
import AppButton from "./AppButton";
import AppTextInput from "./AppTextInput";
import Text from "./LocalizedText";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/useAppSettings";
import { checkUsernameAvailability, saveWalletPin } from "../lib/api";
import { showErrorAlert } from "../lib/errors";
import { radius, spacing, typography } from "../theme/tokens";

export default function MandatoryWalletPinSetup() {
  const { user, dbUser, refreshDbUser } = useAuth();
  const { theme } = useAppSettings();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = Boolean(user && dbUser && dbUser.has_wallet_pin === false);
  const needsGoogleUsername = Boolean(
    visible && !dbUser?.username && String(dbUser?.provider || "").toLowerCase().includes("google"),
  );
  const normalizedUsername = username.trim().toLowerCase().replace(/^@+/, "");

  const canSave = useMemo(
    () =>
      /^\d{4,6}$/.test(pin) &&
      pin === confirmPin &&
      (!needsGoogleUsername || /^[a-z0-9_]{3,30}$/.test(normalizedUsername)),
    [confirmPin, needsGoogleUsername, normalizedUsername, pin],
  );

  async function handleSavePin() {
    if (!/^\d{4,6}$/.test(pin)) {
      Alert.alert("Invalid PIN", "Enter a 4 to 6 digit wallet PIN.");
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert("PIN mismatch", "Both wallet PIN fields must match.");
      return;
    }

    if (needsGoogleUsername && !/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      Alert.alert(
        "Invalid username",
        "Use 3 to 30 lowercase letters, numbers, or underscores.",
      );
      return;
    }

    try {
      setSaving(true);
      if (needsGoogleUsername) {
        const availability = await checkUsernameAvailability(normalizedUsername);
        if (!availability.available) {
          Alert.alert("Username unavailable", "That username is already taken.");
          return;
        }
      }
      await saveWalletPin({
        pin,
        ...(needsGoogleUsername ? { username: normalizedUsername } : {}),
      });
      setUsername("");
      setPin("");
      setConfirmPin("");
      await refreshDbUser();
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => undefined}
    >
      <View style={[styles.backdrop, { backgroundColor: theme.backdrop }]}>
        <View
          style={[
            styles.card,
            { borderColor: theme.border, backgroundColor: theme.card },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>
              Wallet security
            </Text>
            <Text style={[styles.title, { color: theme.text }]}>
              {needsGoogleUsername
                ? "Complete your Google signup"
                : "Set your wallet PIN"}
            </Text>
            <Text style={[styles.subtitle, { color: theme.body }]}>
              {needsGoogleUsername
                ? "Choose your permanent unique username and create your wallet PIN."
                : "Create a wallet PIN before using SplitVerse payments."}
            </Text>
          </View>

          {needsGoogleUsername ? (
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
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="your_username"
              editable={!saving}
            />
          ) : null}

          <AppTextInput
            label="Wallet PIN"
            value={pin}
            onChangeText={(value) =>
              setPin(value.replace(/\D/g, "").slice(0, 6))
            }
            keyboardType="number-pad"
            secureTextEntry
            placeholder="4 to 6 digits"
            editable={!saving}
          />

          <AppTextInput
            label="Confirm PIN"
            value={confirmPin}
            onChangeText={(value) =>
              setConfirmPin(value.replace(/\D/g, "").slice(0, 6))
            }
            keyboardType="number-pad"
            secureTextEntry
            placeholder="Re-enter PIN"
            editable={!saving}
          />

          <AppButton
            title={
              saving
                ? "Saving"
                : needsGoogleUsername
                  ? "Complete setup"
                  : "Save wallet PIN"
            }
            loading={saving}
            disabled={!canSave || saving}
            onPress={handleSavePin}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.base,
  },
  card: {
    gap: spacing.base,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.caption,
  },
  title: {
    ...typography.titleMd,
  },
  subtitle: {
    ...typography.bodySm,
  },
});
