import {
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
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
  return (
    <View {...props} style={[styles.metric, style]}>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  value: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  label: {
    color: colors.body,
    ...typography.caption,
  },
});