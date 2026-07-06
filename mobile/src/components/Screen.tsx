import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, spacing } from "../theme/tokens";

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
};

export default function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
}: ScreenProps) {
  if (!scroll) {
    return <SafeAreaView style={styles.safe}>{children}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.base,
    paddingBottom: spacing.xxl,
  },
});