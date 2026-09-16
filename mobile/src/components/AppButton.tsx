import { memo, useMemo, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
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
  variant?: "primary" | "secondary" | "danger";
  leftIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

function AppButton({
  title,
  loading = false,
  variant = "primary",
  leftIcon,
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
  const visuallyDisabled = Boolean(disabled && !loading);
  const primary = variant === "primary";
  const danger = variant === "danger";

  const backgroundColor = visuallyDisabled
    ? theme.surfaceStrong
    : primary
      ? theme.primary
      : danger
        ? theme.danger
        : theme.surfaceStrong;

  const borderColor = visuallyDisabled
    ? theme.borderSoft
    : primary
      ? theme.primary
      : danger
        ? theme.danger
        : theme.borderSoft;

  const contentColor = primary || danger ? theme.onPrimary : theme.primary;

  const resolvedRipple = useMemo(
    () =>
      androidRipple ?? {
        color: primary
          ? theme.primaryActive
          : danger
            ? "rgba(255,255,255,0.20)"
            : theme.primarySoft,
        borderless: false,
      },
    [
      androidRipple,
      danger,
      primary,
      theme.primaryActive,
      theme.primarySoft,
    ],
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
        style,
        {
          backgroundColor,
          borderColor,
          opacity: visuallyDisabled ? 0.72 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          accessibilityLabel={`${title} in progress`}
          color={contentColor}
        />
      ) : (
        <>
          {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
          <Text
            style={[
              styles.text,
              leftIcon ? styles.textWithIcon : null,
              { color: contentColor },
            ]}
          >
            {title}
          </Text>
        </>
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
  leftIcon: {
    marginRight: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    ...typography.button,
    width: "100%",
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  textWithIcon: {
    width: "auto",
  },
});
