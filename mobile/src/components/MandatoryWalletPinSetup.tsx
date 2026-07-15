import { useMemo, useState } from "react";
import { Alert, Modal, StyleSheet, View } from "react-native";
import AppButton from "./AppButton";
import AppTextInput from "./AppTextInput";
import Text from "./LocalizedText";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/useAppSettings";
import { saveWalletPin } from "../lib/api";
import { showErrorAlert } from "../lib/errors";
import { radius, spacing, typography } from "../theme/tokens";

export default function MandatoryWalletPinSetup() {
  const { user, dbUser, refreshDbUser } = useAuth();
  const { theme } = useAppSettings();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = Boolean(user && dbUser && dbUser.has_wallet_pin === false);

  const canSave = useMemo(
    () => /^\d{4,6}$/.test(pin) && pin === confirmPin,
    [confirmPin, pin],
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

    try {
      setSaving(true);
      await saveWalletPin({ pin });
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
              Set your wallet PIN
            </Text>
            <Text style={[styles.subtitle, { color: theme.body }]}>
              Create a wallet PIN before using SplitVerse payments. This matches
              the website security flow.
            </Text>
          </View>

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
            title={saving ? "Saving PIN" : "Save wallet PIN"}
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
