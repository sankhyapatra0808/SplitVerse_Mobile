import { StyleSheet, View, type ViewProps } from "react-native";
import { spacing } from "../theme/tokens";
import { useAppSettings } from "../context/useAppSettings";
import Text from "./LocalizedText";

type ProfileMetricProps = ViewProps & {
  label: string;
  value: string | number;
};

export default function ProfileMetric({
  label,
  value,
  style,
  ...props
}: ProfileMetricProps) {
  const { theme } = useAppSettings();

  return (
    <View {...props} style={[styles.metric, style]}>
      <Text
        style={[styles.value, { color: theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.58}
      >
        {value}
      </Text>
      <Text style={[styles.label, { color: theme.body }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: spacing.xs,
  },
  value: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
});
