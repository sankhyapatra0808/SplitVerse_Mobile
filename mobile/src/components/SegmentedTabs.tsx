import { Pressable, StyleSheet, View } from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

type TabItem = {
  label: string;
  value: string;
};

type SegmentedTabsProps = {
  value: string;
  onChange: (value: string) => void;
  tabs: TabItem[];
};

export default function SegmentedTabs({
  value,
  onChange,
  tabs,
}: SegmentedTabsProps) {
  const { theme } = useAppSettings();

  const isDark = theme.mode === "dark";

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? theme.background : theme.surfaceStrong,
          borderColor: isDark ? "rgba(255,255,255,0.10)" : theme.border,
        },
      ]}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;

        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={[
              styles.tab,
              active && {
                backgroundColor: isDark ? theme.card : theme.canvas,
                borderColor: theme.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active ? theme.primary : theme.body,
                },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.pill,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  label: {
    ...typography.bodySm,
    fontSize: 14,
    fontWeight: "800",
  },
});
