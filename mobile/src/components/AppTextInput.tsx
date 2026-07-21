import { useEffect, useState } from "react";
import {
  Animated,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { fontFamilies } from "../theme/fonts";
import { spacing, typography } from "../theme/tokens";

type AppTextInputProps = TextInputProps & {
  label: string;
};

export default function AppTextInput({
  label,
  placeholder,
  style,
  value,
  defaultValue,
  onFocus,
  onBlur,
  ...props
}: AppTextInputProps) {
  const { t, theme } = useAppSettings();
  const [focused, setFocused] = useState(false);
  const active = focused || String(value ?? defaultValue ?? "").length > 0;
  const [labelProgress] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    Animated.timing(labelProgress, {
      toValue: active ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [active, labelProgress]);

  const labelTop = labelProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 2],
  });
  const labelSize = labelProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 11],
  });

  return (
    <View style={styles.field}>
      <Animated.Text
        pointerEvents="none"
        style={[
          styles.label,
          {
            top: labelTop,
            color: focused ? theme.primary : theme.muted,
            fontSize: labelSize,
            fontFamily: fontFamilies.libreRegular,
          },
        ]}
      >
        {t(String(label))}
      </Animated.Text>
      <TextInput
        {...props}
        value={value}
        defaultValue={defaultValue}
        placeholder={
          active && placeholder ? t(String(placeholder)) : undefined
        }
        placeholderTextColor={theme.muted}
        selectionColor={theme.primary}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            borderBottomColor: focused ? theme.primary : theme.border,
            color: theme.text,
            backgroundColor: "transparent",
          },
          style,
          {
            fontFamily: fontFamilies.libreRegular,
            fontWeight: "normal",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    position: "relative",
    minHeight: 58,
    justifyContent: "flex-end",
  },
  label: {
    position: "absolute",
    left: 0,
    zIndex: 1,
    ...typography.caption,
  },
  input: {
    minHeight: 56,
    borderWidth: 0,
    borderBottomWidth: 1.5,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingTop: 18,
    paddingBottom: spacing.xs,
    ...typography.bodySm,
  },
});
