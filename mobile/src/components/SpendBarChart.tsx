import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

export type SpendGraphMode = "weekly" | "yearly";

export type SpendGraphPoint = {
  label: string;
  amount: number;
};

type SpendBarChartProps = ViewProps & {
  title: string;
  totalLabel: string;
  mode: SpendGraphMode;
  onModeChange: (mode: SpendGraphMode) => void;
  data: SpendGraphPoint[];
};

function formatAmount(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

export default function SpendBarChart({
  title,
  totalLabel,
  mode,
  onModeChange,
  data,
  style,
  ...props
}: SpendBarChartProps) {
  const maxAmount = Math.max(...data.map((item) => item.amount), 0);
  const halfAmount = maxAmount / 2;

  return (
    <View {...props} style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text style={styles.eyebrow}>
            {mode === "weekly" ? "Amount vs day" : "Amount vs month"}
          </Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.total}>{totalLabel}</Text>
        </View>

        <View style={styles.switcher}>
          <Pressable
            style={[styles.switchButton, mode === "weekly" && styles.activeSwitch]}
            onPress={() => onModeChange("weekly")}
          >
            <Text
              style={[
                styles.switchText,
                mode === "weekly" && styles.activeSwitchText,
              ]}
            >
              Week
            </Text>
          </Pressable>

          <Pressable
            style={[styles.switchButton, mode === "yearly" && styles.activeSwitch]}
            onPress={() => onModeChange("yearly")}
          >
            <Text
              style={[
                styles.switchText,
                mode === "yearly" && styles.activeSwitchText,
              ]}
            >
              Year
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.graphArea}>
        <View style={styles.yAxis}>
          <Text style={styles.axisText}>{formatAmount(maxAmount)}</Text>
          <Text style={styles.axisText}>{formatAmount(halfAmount)}</Text>
          <Text style={styles.axisText}>₹0</Text>
        </View>

        <View style={styles.chart}>
          {data.map((item) => {
            const barHeight =
              maxAmount > 0 && item.amount > 0
                ? Math.max(4, (item.amount / maxAmount) * 100)
                : 0;

            return (
              <View style={styles.barColumn} key={item.label}>
                <Text style={styles.amountLabel}>
                  {item.amount > 0 ? formatAmount(item.amount) : ""}
                </Text>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${barHeight}%` }]} />
                </View>

                <Text style={styles.xLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.body,
    ...typography.caption,
  },
  title: {
    marginTop: spacing.xs,
    color: colors.ink,
    ...typography.titleMd,
  },
  total: {
    marginTop: 2,
    color: colors.body,
    ...typography.bodySm,
  },
  switcher: {
    flexDirection: "row",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    padding: 4,
  },
  switchButton: {
    minHeight: 32,
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
  },
  activeSwitch: {
    backgroundColor: colors.canvas,
  },
  switchText: {
    color: colors.body,
    fontSize: 12,
    fontWeight: "600",
  },
  activeSwitchText: {
    color: colors.ink,
  },
  graphArea: {
    minHeight: 210,
    flexDirection: "row",
    gap: spacing.sm,
  },
  yAxis: {
    width: 48,
    justifyContent: "space-between",
    paddingTop: 20,
    paddingBottom: 24,
  },
  axisText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
  },
  chart: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  barColumn: {
    flex: 1,
    minWidth: 0,
    height: 190,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  amountLabel: {
    minHeight: 14,
    color: colors.body,
    fontSize: 9,
    fontWeight: "600",
  },
  barTrack: {
    width: "100%",
    height: 126,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
  },
  barFill: {
    width: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  xLabel: {
    color: colors.body,
    fontSize: 10,
    fontWeight: "600",
  },
});