import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing } from "../theme/tokens";

export default function AppCard({ children, style, ...props }: ViewProps) {
  const { theme, compactMode } = useAppSettings();
  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          borderColor:
            theme.mode === "dark" ? "rgba(255,255,255,0.08)" : theme.borderSoft,
          backgroundColor: theme.card,
          padding: compactMode ? spacing.base : spacing.lg,
          shadowOpacity: theme.mode === "dark" ? 0 : 0.05,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    shadowColor: "#000",
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: Platform.OS === "android" ? 1 : 0,
  },
});
