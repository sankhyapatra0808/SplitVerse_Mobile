import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radius, spacing } from "../theme/tokens";

export default function AppCard({ children, style, ...props }: ViewProps) {
  return (
    <View {...props} style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceCard,
    padding: spacing.lg,
  },
});