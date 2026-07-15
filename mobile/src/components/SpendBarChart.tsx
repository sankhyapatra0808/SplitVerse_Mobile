import { memo, useCallback, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
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
  selectedIndex?: number | null;
  onSelectPoint?: (point: SpendGraphPoint | null, index: number | null) => void;
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

function SpendBarChart({
  title,
  totalLabel,
  mode,
  onModeChange,
  data,
  selectedIndex = null,
  onSelectPoint,
  style,
  ...props
}: SpendBarChartProps) {
  const { formatCurrency, theme } = useAppSettings();

  const formatAmount = useCallback(
    (amount: number) => formatCurrency(amount, { compact: true }),
    [formatCurrency],
  );

  const normalizedData = useMemo(
    () =>
      mode === "yearly"
        ? data.map((item) => ({
            ...item,
            label: getMonthLabel(item.label),
          }))
        : data,
    [data, mode],
  );

  const maxAmount = useMemo(
    () =>
      Math.max(...normalizedData.map((item) => Number(item.amount || 0)), 0),
    [normalizedData],
  );

  const halfAmount = maxAmount / 2;

  function handleModePress(
    event: GestureResponderEvent,
    nextMode: SpendGraphMode,
  ) {
    event.stopPropagation();
    onModeChange(nextMode);
  }

  function handleBarPress(
    event: GestureResponderEvent,
    item: SpendGraphPoint,
    index: number,
  ) {
    event.stopPropagation();

    if (selectedIndex === index) {
      onSelectPoint?.(null, null);
      return;
    }

    onSelectPoint?.(item, index);
  }

  return (
    <View
      {...props}
      style={[
        styles.card,
        { borderColor: theme.border, backgroundColor: theme.card },
        style,
      ]}
    >
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.total, { color: theme.body }]}>
            {totalLabel}
          </Text>
        </View>

        <View
          style={[styles.switcher, { backgroundColor: theme.surfaceStrong }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === "weekly" }}
            accessibilityLabel="Show weekly spending"
            style={[
              styles.switchButton,
              mode === "weekly" && { backgroundColor: theme.canvas },
            ]}
            onPress={(event) => handleModePress(event, "weekly")}
          >
            <Text
              style={[
                styles.switchText,
                { color: mode === "weekly" ? theme.text : theme.body },
              ]}
            >
              Week
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === "yearly" }}
            accessibilityLabel="Show yearly spending"
            style={[
              styles.switchButton,
              mode === "yearly" && { backgroundColor: theme.canvas },
            ]}
            onPress={(event) => handleModePress(event, "yearly")}
          >
            <Text
              style={[
                styles.switchText,
                { color: mode === "yearly" ? theme.text : theme.body },
              ]}
            >
              Year
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.graphArea}>
        <View style={styles.yAxis}>
          <Text style={[styles.axisText, { color: theme.body }]}>
            {formatAmount(maxAmount)}
          </Text>
          <Text style={[styles.axisText, { color: theme.body }]}>
            {formatAmount(halfAmount)}
          </Text>
          <Text style={[styles.axisText, { color: theme.body }]}>
            {formatAmount(0)}
          </Text>
        </View>

        <View style={styles.chart}>
          {normalizedData.map((item, index) => {
            const amount = Number(item.amount || 0);

            const barHeight =
              maxAmount > 0 && amount > 0
                ? Math.max(4, (amount / maxAmount) * 100)
                : 0;

            const selected = selectedIndex === index;
            const dimmed = selectedIndex !== null && !selected;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.label}: ${formatAmount(amount)}`}
                style={[
                  styles.barColumn,
                  {
                    opacity: dimmed ? 0.22 : 1,
                  },
                ]}
                key={`${item.label}-${index}`}
                onPress={(event) => handleBarPress(event, item, index)}
              >
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: theme.surfaceStrong },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${barHeight}%`,
                        backgroundColor: theme.primary,
                      },
                    ]}
                  />
                </View>

                <Text
                  style={[
                    styles.xLabel,
                    {
                      color: selected ? theme.primary : theme.body,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default memo(SpendBarChart);

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
  switchText: {
    color: colors.body,
    fontSize: 12,
    fontWeight: "600",
  },
  graphArea: {
    minHeight: 210,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  yAxis: {
    width: 38,
    height: 162,
    justifyContent: "space-between",
    marginBottom: 24,
  },
  chart: {
    flex: 1,
    height: 190,
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
  barTrack: {
    width: "100%",
    minWidth: 16,
    height: 162,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
  },
  axisText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "600",
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
