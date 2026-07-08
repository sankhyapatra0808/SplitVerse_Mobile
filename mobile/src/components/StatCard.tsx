import {
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";
import AmountText from "./AmountText";
import Text from "./LocalizedText";

type StatCardProps = ViewProps & {
  label: string;
  value?: string;
  amount?: number;
  helper?: string;
  tone?: "default" | "success" | "danger" | "primary";
};

export default function StatCard({
  label,
  value,
  amount,
  helper,
  tone = "default",
  style,
  ...props
}: StatCardProps) {
  return (
    <View {...props} style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>

      {typeof amount === "number" ? (
        <AmountText amount={amount} size="md" tone={tone} />
      ) : (
        <Text style={styles.value}>{value ?? "—"}</Text>
      )}

      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceCard,
    padding: spacing.base,
    justifyContent: "space-between",
  },
  label: {
    color: colors.body,
    ...typography.caption,
  },
  value: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
  },
  helper: {
    color: colors.muted,
    ...typography.bodySm,
  },
});