import {
  StyleSheet,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

type EmptyStateProps = {
  title: string;
  message?: string;
};

export default function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.base,
  },
  title: {
    color: colors.ink,
    ...typography.titleSm,
  },
  message: {
    color: colors.body,
    ...typography.bodySm,
  },
});