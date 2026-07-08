import { StyleSheet, View } from "react-native";
import { PageSkeleton } from "./Skeleton";
import { spacing } from "../theme/tokens";

type LoadingStateProps = {
  label?: string;
  skeleton?: boolean;
};

export default function LoadingState({ skeleton = true }: LoadingStateProps) {
  if (skeleton) {
    return (
      <View style={styles.skeletonWrap}>
        <PageSkeleton />
      </View>
    );
  }

  return <View style={styles.loading} />;
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 120,
  },
  skeletonWrap: {
    gap: spacing.sm,
  },
});
