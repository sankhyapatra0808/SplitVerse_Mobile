import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
  const selected =
    options.find((option) => option.value === value) ?? options[0];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Pressable
        style={[
          styles.trigger,
          { borderColor: theme.border, backgroundColor: theme.canvas },
        ]}
        onPress={() => setOpen((current) => !current)}
      >
        <View style={styles.triggerCopy}>
          <Text style={[styles.triggerText, { color: theme.text }]}>
            {selected?.label ?? value}
          </Text>
          {selected?.helper ? (
            <Text style={[styles.helper, { color: theme.body }]}>
              {selected.helper}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.body}
        />
      </Pressable>
      {open ? (
        <View
          style={[
            styles.menu,
            { borderColor: theme.border, backgroundColor: theme.card },
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
                      borderColor: active
                        ? theme.primary
                        : theme.mode === "dark"
                          ? "rgba(229,231,235,0.78)"
                          : theme.border,
                      backgroundColor: active
                        ? theme.primary
                        : theme.mode === "dark"
                          ? "rgba(255,255,255,0.03)"
                          : "transparent",
                    },
                  ]}
                >
                  {active ? (
                    <Ionicons
                      name="checkmark"
                      size={13}
                      color={theme.onPrimary}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
  },
  trigger: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  triggerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  triggerText: {
    ...typography.titleSm,
  },
  helper: {
    ...typography.caption,
  },
  menu: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  option: {
    minHeight: 48,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  optionText: {
    ...typography.bodySm,
    fontWeight: "700",
  },
  radio: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: radius.full,
  },
});
