import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

type EmptyStateProps = {
  title: string;
  message?: string;
};

function EmptyState({ title, message }: EmptyStateProps) {
  const { theme } = useAppSettings();
  return (
    <View
      style={[
        styles.empty,
        { borderColor: theme.borderSoft, backgroundColor: theme.surface },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.message, { color: theme.body }]}>{message}</Text>
      ) : null}
    </View>
  );
}

export default memo(EmptyState);

const styles = StyleSheet.create({
  empty: {
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  title: {
    ...typography.titleSm,
  },
  message: {
    ...typography.bodySm,
  },
});
