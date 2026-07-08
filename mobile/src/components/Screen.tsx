import { router, usePathname } from "expo-router";
import { useMemo, type ReactNode } from "react";
import {
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme/tokens";

const tabOrder = [
  "/(tabs)/dashboard",
  "/(tabs)/split-rooms",
  "/(tabs)/wallet",
  "/(tabs)/profile",
];

const pathnameToTabIndex: Record<string, number> = {
  "/dashboard": 0,
  "/split-rooms": 1,
  "/wallet": 2,
  "/profile": 3,
};

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  swipeTabs?: boolean;
};

export default function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
  swipeTabs = true,
}: ScreenProps) {
  const pathname = usePathname();

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (!swipeTabs) return false;

          const tabIndex = pathnameToTabIndex[pathname];

          if (tabIndex === undefined) return false;

          const horizontal = Math.abs(gesture.dx) > 42;
          const mostlyHorizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.8;

          return horizontal && mostlyHorizontal;
        },
        onPanResponderRelease: (_, gesture) => {
          const currentIndex = pathnameToTabIndex[pathname];

          if (currentIndex === undefined) return;

          const swipeLeft = gesture.dx < -70;
          const swipeRight = gesture.dx > 70;

          if (swipeLeft && currentIndex < tabOrder.length - 1) {
            router.replace(tabOrder[currentIndex + 1] as never);
          }

          if (swipeRight && currentIndex > 0) {
            router.replace(tabOrder[currentIndex - 1] as never);
          }
        },
      }),
    [pathname, swipeTabs],
  );

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} {...panResponder.panHandlers}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} {...panResponder.panHandlers}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEventThrottle={16}
        overScrollMode="never"
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