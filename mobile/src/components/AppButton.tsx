import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

type AppButtonProps = Omit<PressableProps, "style"> & {
  title: string;
  loading?: boolean;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
};

export default function AppButton({
  title,
  loading = false,
  variant = "primary",
  disabled,
  style,
  ...props
}: AppButtonProps) {
  const { theme } = useAppSettings();
  const isDisabled = disabled || loading;
  const primary = variant === "primary";

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      android_ripple={{ color: primary ? theme.primaryActive : theme.borderSoft, borderless: false }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isDisabled
            ? theme.surfaceStrong
            : primary
              ? theme.primary
              : theme.surfaceStrong,
          borderColor: primary ? theme.primary : theme.borderSoft,
          opacity: isDisabled ? 0.72 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? theme.onPrimary : theme.text} />
      ) : (
        <Text style={[styles.text, { color: primary ? theme.onPrimary : theme.primary }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    ...typography.button,
  },
});
