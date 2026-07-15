import { StyleSheet, View } from "react-native";
import { radius, spacing, typography } from "../theme/tokens";
import { useAppSettings } from "../context/useAppSettings";
import Text from "./LocalizedText";

type MiniBarChartProps = {
  title: string;
  valueLabel?: string;
  data: number[];
};

export default function MiniBarChart({
  title,
  valueLabel,
  data,
}: MiniBarChartProps) {
  const { theme } = useAppSettings();
  const max = Math.max(...data, 1);

  return (
    <View
      style={[
        styles.card,
        { borderColor: theme.border, backgroundColor: theme.card },
      ]}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {valueLabel ? (
          <Text style={[styles.value, { color: theme.body }]}>
            {valueLabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.chart}>
        {data.map((item, index) => {
          const height = Math.max(10, (item / max) * 96);

          return (
            <View
              style={[
                styles.barTrack,
                { backgroundColor: theme.surfaceStrong },
              ]}
              key={`${item}-${index}`}
            >
              <View
                style={[styles.bar, { height, backgroundColor: theme.primary }]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.base,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.base,
  },
  head: {
    gap: spacing.xs,
  },
  title: {
    ...typography.titleMd,
  },
  value: {
    ...typography.bodySm,
  },
  chart: {
    height: 120,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  barTrack: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  bar: {
    borderRadius: radius.pill,
  },
});
