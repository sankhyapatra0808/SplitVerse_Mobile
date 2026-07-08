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
import { useAppSettings } from "../context/useAppSettings";
import { spacing } from "../theme/tokens";

const tabOrder = ["/(tabs)/dashboard", "/(tabs)/split-rooms", "/(tabs)/wallet", "/(tabs)/profile"];

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
  safeBackgroundColor?: string;
};

export default function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
  swipeTabs = true,
  safeBackgroundColor,
}: ScreenProps) {
  const pathname = usePathname();
  const { theme } = useAppSettings();

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (!swipeTabs) return false;
          const tabIndex = pathnameToTabIndex[pathname];
          if (tabIndex === undefined) return false;
          const horizontal = Math.abs(gesture.dx) > 58;
          const mostlyHorizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2.2;
          return horizontal && mostlyHorizontal;
        },
        onPanResponderRelease: (_, gesture) => {
          const currentIndex = pathnameToTabIndex[pathname];
          if (currentIndex === undefined) return;
          const swipeLeft = gesture.dx < -92;
          const swipeRight = gesture.dx > 92;
          if (swipeLeft && currentIndex < tabOrder.length - 1) router.replace(tabOrder[currentIndex + 1] as never);
          if (swipeRight && currentIndex > 0) router.replace(tabOrder[currentIndex - 1] as never);
        },
      }),
    [pathname, swipeTabs],
  );

  const safeStyle = [styles.safe, { backgroundColor: safeBackgroundColor ?? theme.background }];

  if (!scroll) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={safeStyle} {...panResponder.panHandlers}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={safeStyle} {...panResponder.panHandlers}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.background }, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEventThrottle={16}
        overScrollMode="never"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
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
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.base,
    paddingBottom: spacing.xxl,
  },
});
