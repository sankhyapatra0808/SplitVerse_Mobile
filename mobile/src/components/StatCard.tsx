import { StyleSheet, View, type ViewProps } from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing, typography } from "../theme/tokens";
import AmountText from "./AmountText";
import Text from "./LocalizedText";

type StatCardProps = ViewProps & {
  label: string;
  value?: string;
  amount?: number;
  helper?: string;
  tone?: "default" | "success" | "danger" | "primary";
};

export default function StatCard({ label, value, amount, helper, tone = "default", style, ...props }: StatCardProps) {
  const { theme } = useAppSettings();
  return (
    <View {...props} style={[styles.card, { borderColor: theme.borderSoft, backgroundColor: theme.card }, style]}>
      <Text style={[styles.label, { color: theme.body }]}>{label}</Text>
      {typeof amount === "number" ? <AmountText amount={amount} size="md" tone={tone} /> : <Text style={[styles.value, { color: theme.text }]}>{value ?? "—"}</Text>}
      {helper ? <Text style={[styles.helper, { color: theme.muted }]}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 112,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.base,
    justifyContent: "space-between",
  },
  label: {
    ...typography.caption,
  },
  value: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
  },
  helper: {
    ...typography.bodySm,
  },
});
