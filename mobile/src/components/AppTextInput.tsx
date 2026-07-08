import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import Text from "./LocalizedText";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing, typography } from "../theme/tokens";

type AppTextInputProps = TextInputProps & {
  label: string;
};

export default function AppTextInput({
  label,
  placeholder,
  style,
  ...props
}: AppTextInputProps) {
  const { t, theme } = useAppSettings();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        {...props}
        placeholder={placeholder ? t(String(placeholder)) : undefined}
        placeholderTextColor={theme.muted}
        selectionColor={theme.primary}
        style={[
          styles.input,
          {
            borderColor: theme.border,
            color: theme.text,
            backgroundColor: theme.surface,
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.base,
    ...typography.bodySm,
  },
});
