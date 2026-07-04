import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

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
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" ? styles.primary : styles.secondary,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.onPrimary : colors.ink}
        />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "primary" ? styles.primaryText : styles.secondaryText,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surfaceStrong,
  },
  pressed: {
    transform: [{ translateY: 1 }],
    opacity: 0.92,
  },
  disabled: {
    backgroundColor: colors.primaryDisabled,
  },
  text: {
    ...typography.button,
  },
  primaryText: {
    color: colors.onPrimary,
  },
  secondaryText: {
    color: colors.ink,
  },
});