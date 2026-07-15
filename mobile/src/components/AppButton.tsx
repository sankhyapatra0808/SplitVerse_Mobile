import { memo, useMemo } from "react";
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

function AppButton({
  title,
  loading = false,
  variant = "primary",
  disabled,
  style,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  android_ripple: androidRipple,
  ...props
}: AppButtonProps) {
  const { theme } = useAppSettings();
  const isDisabled = Boolean(disabled || loading);
  const primary = variant === "primary";

  const resolvedRipple = useMemo(
    () =>
      androidRipple ?? {
        color: primary ? theme.primaryActive : theme.borderSoft,
        borderless: false,
      },
    [androidRipple, primary, theme.borderSoft, theme.primaryActive],
  );

  return (
    <Pressable
      {...props}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{
        ...accessibilityState,
        disabled: isDisabled,
        busy: loading,
      }}
      disabled={isDisabled}
      android_ripple={resolvedRipple}
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
        <ActivityIndicator
          accessibilityLabel={`${title} in progress`}
          color={primary ? theme.onPrimary : theme.text}
        />
      ) : (
        <Text
          style={[
            styles.text,
            { color: primary ? theme.onPrimary : theme.primary },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export default memo(AppButton);

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  text: {
    ...typography.button,
    width: "100%",
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
});
