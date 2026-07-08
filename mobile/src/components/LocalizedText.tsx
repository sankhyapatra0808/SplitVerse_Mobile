import { Text as NativeText, type TextProps } from "react-native";
import type { ReactNode } from "react";
import { useAppSettings } from "../context/useAppSettings";

function translateChildren(children: ReactNode, translate: (value: string) => string): ReactNode {
  if (typeof children === "string") {
    return translate(children);
  }

  if (typeof children === "number") {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map((child) => translateChildren(child, translate));
  }

  return children;
}

export default function Text({ children, ...props }: TextProps) {
  const { t } = useAppSettings();

  return <NativeText {...props}>{translateChildren(children, t)}</NativeText>;
}
