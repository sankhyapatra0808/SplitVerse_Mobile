import { StyleSheet, Text } from "react-native";
import AppButton from "../../src/components/AppButton";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function Settings() {
  const { logout } = useAuth();

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>
      <AppButton title="Logout" variant="secondary" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    color: colors.ink,
    ...typography.titleLg,
  },
});