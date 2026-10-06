import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

type DropdownOption<T extends string> = {
  label: string;
  value: T;
  helper?: string;
};

type DropdownSelectProps<T extends string> = {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
};

export default function DropdownSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: DropdownSelectProps<T>) {
  const { theme } = useAppSettings();
  const [open, setOpen] = useState(false);
  const motion = useRef(new Animated.Value(0)).current;
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    Animated.timing(motion, {
      toValue: open ? 1 : 0,
      duration: open ? 220 : 160,
      easing: open ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [motion, open]);

  const chevronRotate = motion.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.body }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[
          styles.trigger,
          {
            borderColor: open ? theme.primary : theme.border,
            backgroundColor: theme.canvas,
          },
          open && { shadowColor: theme.primary, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
        ]}
        onPress={() => setOpen((current) => !current)}
      >
        <View style={styles.triggerCopy}>
          <Text style={[styles.triggerText, { color: theme.text }]}>
            {selected?.label || value || "Select"}
          </Text>
          {selected?.helper ? (
            <Text style={[styles.helper, { color: theme.body }]}>
              {selected.helper}
            </Text>
          ) : null}
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-down" size={18} color={open ? theme.text : theme.body} />
        </Animated.View>
      </Pressable>

      {open ? (
        <Animated.View
          style={[
            styles.menu,
            {
              borderColor: theme.border,
              backgroundColor: theme.card,
              opacity: motion,
              transform: [
                {
                  translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
                },
                {
                  scale: motion.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }),
                },
              ],
            },
          ]}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.option,
                  active && { backgroundColor: theme.primarySoft },
                ]}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <View style={styles.triggerCopy}>
                  <Text
                    style={[
                      styles.optionText,
                      { color: active ? theme.primary : theme.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.helper ? (
                    <Text style={[styles.helper, { color: theme.body }]}>
                      {option.helper}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? theme.primary : "transparent",
                    },
                  ]}
                >
                  {active ? <Ionicons name="checkmark" size={13} color={theme.onPrimary} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.caption },
  trigger: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  triggerCopy: { flex: 1, minWidth: 0, gap: 2 },
  triggerText: { ...typography.titleSm, fontWeight: "500" },
  helper: { ...typography.caption, fontWeight: "400" },
  menu: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 5,
  },
  option: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  optionText: { ...typography.bodySm, fontWeight: "500" },
  radio: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: radius.full,
  },
});
