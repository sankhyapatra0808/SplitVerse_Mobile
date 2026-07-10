import type { TextStyle } from "react-native";

export const fontFamilies = {
  libreRegular: "LibreBaskerville_400Regular",
  libreMedium: "LibreBaskerville_500Medium",
  libreSemiBold: "LibreBaskerville_600SemiBold",
  libreBold: "LibreBaskerville_700Bold",
  instrumentRegular: "InstrumentSerif_400Regular",
} as const;

function getNumericWeight(weight: TextStyle["fontWeight"]) {
  if (typeof weight === "number") return weight;
  if (weight === "bold") return 700;
  if (!weight || weight === "normal") return 400;

  const parsedWeight = Number.parseInt(weight, 10);
  return Number.isFinite(parsedWeight) ? parsedWeight : 400;
}

export function resolveTextFontFamily(style: TextStyle) {
  if (style.fontFamily === fontFamilies.instrumentRegular) {
    return fontFamilies.instrumentRegular;
  }

  const weight = getNumericWeight(style.fontWeight);

  if (weight >= 700) return fontFamilies.libreBold;
  if (weight >= 600) return fontFamilies.libreSemiBold;
  if (weight >= 500) return fontFamilies.libreMedium;
  return fontFamilies.libreRegular;
}
