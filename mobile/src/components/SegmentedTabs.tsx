import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

type Tab = {
  label: string;
  value: string;
};

type SegmentedTabsProps = {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
};

export default function SegmentedTabs({
  tabs,
  value,
  onChange,
}: SegmentedTabsProps) {
  return (
    <View style={styles.wrapper}>
      {tabs.map((tab) => {
        const active = tab.value === value;

        return (
          <Pressable
            key={tab.value}
            style={[styles.tab, active && styles.activeTab]}
            onPress={() => onChange(tab.value)}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  activeTab: {
    backgroundColor: colors.canvas,
  },
  label: {
    color: colors.body,
    ...typography.caption,
  },
  activeLabel: {
    color: colors.ink,
  },
});