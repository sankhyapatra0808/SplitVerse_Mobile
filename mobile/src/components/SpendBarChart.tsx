import {
  Pressable,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { useAppSettings } from "../context/useAppSettings";
import Text from "./LocalizedText";

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

function getMonthLabel(label: string) {
  const cleanLabel = String(label || "").trim();

  const monthMap: Record<string, string> = {
    january: "Jan",
    jan: "Jan",
    february: "Feb",
    feb: "Feb",
    march: "Mar",
    mar: "Mar",
    april: "Apr",
    apr: "Apr",
    may: "May",
    june: "Jun",
    jun: "Jun",
    july: "Jul",
    jul: "Jul",
    august: "Aug",
    aug: "Aug",
    september: "Sep",
    sep: "Sep",
    sept: "Sep",
    october: "Oct",
    oct: "Oct",
    november: "Nov",
    nov: "Nov",
    december: "Dec",
    dec: "Dec",
  };

  const lower = cleanLabel.toLowerCase();

  if (monthMap[lower]) {
    return monthMap[lower];
  }

  const firstWord = lower.split(/\s+/)[0];

  if (monthMap[firstWord]) {
    return monthMap[firstWord];
  }

  return cleanLabel;
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
  const { formatCurrency } = useAppSettings();
  const formatAmount = (amount: number) => formatCurrency(amount, { compact: true });
  const normalizedData =
    mode === "yearly"
      ? data.map((item) => ({
          ...item,
          label: getMonthLabel(item.label),
        }))
      : data;

  const maxAmount = Math.max(
    ...normalizedData.map((item) => Number(item.amount || 0)),
    0,
  );

  const halfAmount = maxAmount / 2;

  return (
    <View {...props} style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={styles.headCopy}>
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
          <Text style={styles.axisText}>{formatAmount(0)}</Text>
        </View>

        <View style={styles.chart}>
          {normalizedData.map((item, index) => {
            const amount = Number(item.amount || 0);

            const barHeight =
              maxAmount > 0 && amount > 0
                ? Math.max(4, (amount / maxAmount) * 100)
                : 0;

            return (
              <View style={styles.barColumn} key={`${item.label}-${index}`}>
                <Text style={styles.amountLabel}>
                  {amount > 0 ? formatAmount(amount) : ""}
                </Text>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${barHeight}%` }]} />
                </View>

                <Text style={styles.xLabel}>{item.label}</Text>
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
    paddingHorizontal: 12,
    paddingVertical: spacing.base,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
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
    minWidth: 52,
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
    gap: 6,
  },
  yAxis: {
    width: 38,
    justifyContent: "space-between",
    paddingTop: 20,
    paddingBottom: 24,
  },
  axisText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "600",
  },
  chart: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4,
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
    fontSize: 8,
    fontWeight: "600",
  },
  barTrack: {
    width: "100%",
    minWidth: 16,
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
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
});