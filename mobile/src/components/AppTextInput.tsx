import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

type AppTextInputProps = TextInputProps & {
  label: string;
};

export default function AppTextInput({
  label,
  style,
  ...props
}: AppTextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.ink,
    ...typography.caption,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    color: colors.ink,
    backgroundColor: colors.canvas,
    ...typography.bodySm,
  },
});