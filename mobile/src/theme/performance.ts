import { Platform } from "react-native";

/**
 * Android blur is deliberately lower than iOS because real-time bitmap blur
 * is substantially more expensive on lower-end Android GPUs. The visual style
 * remains the same while reducing frame drops and memory pressure.
 */
export const HERO_BLUR_RADIUS = Platform.OS === "android" ? 16 : 28;
