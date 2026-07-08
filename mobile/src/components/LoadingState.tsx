import { StyleSheet, View } from "react-native";
import Text from "./LocalizedText";
import { PageSkeleton } from "./Skeleton";
import { colors, spacing, typography } from "../theme/tokens";

type LoadingStateProps = {
  label?: string;
  skeleton?: boolean;
};

export default function LoadingState({ label = "Loading...", skeleton = true }: LoadingStateProps) {
  if (skeleton) {
    return (
      <View style={styles.skeletonWrap}>
        <PageSkeleton />
        <Text style={styles.label}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.loading}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  skeletonWrap: {
    gap: spacing.sm,
  },
  label: {
    color: colors.body,
    ...typography.bodySm,
  },
});
