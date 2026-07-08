import { Pressable, StyleSheet, View } from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

type Tab = {
  label: string;
  value: string;
};

type SegmentedTabsProps = {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
};

export default function SegmentedTabs({ tabs, value, onChange }: SegmentedTabsProps) {
  const { theme } = useAppSettings();

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.surfaceStrong }]}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            android_ripple={{ color: theme.borderSoft, borderless: false }}
            style={({ pressed }) => [
              styles.tab,
              active && { backgroundColor: theme.card, borderColor: theme.primary },
              { transform: [{ scale: pressed ? 0.98 : active ? 1.02 : 1 }] },
            ]}
            onPress={() => onChange(tab.value)}
          >
            <Text style={[styles.label, { color: active ? theme.primary : theme.body }]}>{tab.label}</Text>
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
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  label: {
    ...typography.caption,
  },
});
