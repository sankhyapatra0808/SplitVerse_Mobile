import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import Text from "./LocalizedText";
import { useAppSettings } from "../context/useAppSettings";
import { colors, radius, spacing, typography } from "../theme/tokens";

type AppTextInputProps = TextInputProps & {
  label: string;
};

export default function AppTextInput({
  label,
  placeholder,
  style,
  ...props
}: AppTextInputProps) {
  const { t } = useAppSettings();

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholder={placeholder ? t(String(placeholder)) : undefined}
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
