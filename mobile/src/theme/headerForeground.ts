import type { ThemeColors } from "../context/useAppSettings";

/** Keep existing dark-mode header colors; use true black in light mode. */
export function headerForeground(theme: ThemeColors, darkColor: string): string {
  return theme.mode === "light" ? "#000000" : darkColor;
}
