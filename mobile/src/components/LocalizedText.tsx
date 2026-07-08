import { Fragment, type ReactNode } from "react";
import { StyleSheet, Text as NativeText, type TextProps } from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { colors } from "../theme/tokens";

function translateChildren(children: ReactNode, translate: (value: string) => string): ReactNode {
  if (typeof children === "string") return translate(children);
  if (typeof children === "number") return children;
  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <Fragment key={index}>{translateChildren(child, translate)}</Fragment>
    ));
  }
  return children;
}

export default function Text({ children, style, ...props }: TextProps) {
  const { t, theme } = useAppSettings();
  const flatStyle = StyleSheet.flatten(style) ?? {};
  const currentColor = flatStyle.color;

  let mappedColor: string | undefined;
  if (!currentColor || currentColor === colors.ink) mappedColor = theme.text;
  else if (currentColor === colors.body) mappedColor = theme.body;
  else if (currentColor === colors.muted || currentColor === colors.mutedSoft) mappedColor = theme.muted;
  else if (currentColor === colors.primary || currentColor === colors.primaryActive) mappedColor = theme.primary;
  else if (currentColor === colors.success) mappedColor = theme.success;
  else if (currentColor === colors.danger) mappedColor = theme.danger;
  else if (currentColor === colors.warning) mappedColor = theme.warning;

  return (
    <NativeText {...props} style={[style, mappedColor ? { color: mappedColor } : null]}>
      {translateChildren(children, t)}
    </NativeText>
  );
}
