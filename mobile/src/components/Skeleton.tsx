import { StyleSheet, View, type ViewStyle, type StyleProp } from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing } from "../theme/tokens";

type SkeletonLineProps = {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonLine({ width = "100%", height = 14, style }: SkeletonLineProps) {
  const { theme } = useAppSettings();
  return <View style={[styles.line, { width, height, backgroundColor: theme.surfaceStrong }, style]} />;
}

export function SkeletonCard() {
  const { theme } = useAppSettings();
  return (
    <View style={[styles.card, { borderColor: theme.borderSoft, backgroundColor: theme.card }]}>
      <SkeletonLine width="38%" height={12} />
      <SkeletonLine width="72%" height={26} />
      <SkeletonLine width="100%" height={14} />
      <SkeletonLine width="84%" height={14} />
    </View>
  );
}

export function PageSkeleton() {
  return (
    <View style={styles.page}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.base,
  },
  card: {
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.base,
  },
  line: {
    overflow: "hidden",
    borderRadius: radius.pill,
  },
});
