import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

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
  const max = Math.max(...data, 1);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {valueLabel ? <Text style={styles.value}>{valueLabel}</Text> : null}
      </View>

      <View style={styles.chart}>
        {data.map((item, index) => {
          const height = Math.max(10, (item / max) * 96);

          return (
            <View style={styles.barTrack} key={`${item}-${index}`}>
              <View style={[styles.bar, { height }]} />
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
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.canvas,
    padding: spacing.base,
  },
  head: {
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    ...typography.titleMd,
  },
  value: {
    color: colors.body,
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
    backgroundColor: colors.surfaceStrong,
    overflow: "hidden",
  },
  bar: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});