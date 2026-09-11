export const colors = {
  primary: "#0052ff",
  primaryActive: "#003ecc",
  primaryDisabled: "#a8b8cc",

  ink: "#0a0b0d",
  body: "#5b616e",
  muted: "#7c828a",
  mutedSoft: "#a8acb3",

  hairline: "#ddd7cd",
  hairlineSoft: "#ebe5da",

  canvas: "#fffdf9",
  surfaceSoft: "#faf7f0",
  surfaceCard: "#fffdf9",
  surfaceStrong: "#ebe5da",
  surfaceDark: "#0a0b0d",
  surfaceDarkElevated: "#16181c",

  onPrimary: "#ffffff",
  onDark: "#ffffff",

  success: "#05b169",
  danger: "#cf202f",
  warning: "#f4b000",
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 100,
  full: 9999,
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  base: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  titleLg: {
    fontSize: 32,
    fontWeight: "400" as const,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  titleMd: {
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 24,
  },
  titleSm: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 20,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  bodySm: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 21,
  },
  caption: {
    fontSize: 12,
    fontWeight: "600" as const,
    lineHeight: 18,
  },
  button: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 18,
  },
};
