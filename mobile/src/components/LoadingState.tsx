import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";

type LoadingStateProps = {
  label?: string;
};

export default function LoadingState({ label = "Loading..." }: LoadingStateProps) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  label: {
    color: colors.body,
    ...typography.bodySm,
  },
});