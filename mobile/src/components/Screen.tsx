import { router, usePathname } from "expo-router";
import { useMemo, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { spacing } from "../theme/tokens";
import { useAppSettings } from "../context/useAppSettings";

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
  onRefresh?: () => void | Promise<void>;
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
  const { theme } = useAppSettings();
  const { width } = useWindowDimensions();
  const resolvedBackground = safeBackgroundColor ?? theme.background;
  const pathname = usePathname();
  const translateX = useRef(new Animated.Value(0)).current;
  const currentIndex = pathnameToTabIndex[pathname];

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (!swipeTabs || currentIndex === undefined) return false;

          const horizontal = Math.abs(gesture.dx) > 14;
          const mostlyHorizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.55;
          return horizontal && mostlyHorizontal;
        },
        onPanResponderGrant: () => {
          translateX.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          if (!swipeTabs || currentIndex === undefined) return;

          const direction = gesture.dx < 0 ? 1 : -1;
          const targetIndex = currentIndex + direction;
          const hasTarget = targetIndex >= 0 && targetIndex < tabOrder.length;

          const clamped = Math.max(-width, Math.min(width, gesture.dx));
          translateX.setValue(hasTarget ? clamped : clamped * 0.12);
        },
        onPanResponderRelease: (_, gesture) => {
          if (currentIndex === undefined) return;

          const direction = gesture.dx < 0 ? 1 : -1;
          const targetIndex = currentIndex + direction;
          const hasTarget = targetIndex >= 0 && targetIndex < tabOrder.length;
          const travelThreshold = Math.min(110, width * 0.24);
          const velocityCommit = Math.abs(gesture.vx) > 0.58;
          const distanceCommit = Math.abs(gesture.dx) > travelThreshold;
          const shouldNavigate = hasTarget && (distanceCommit || velocityCommit);

          if (shouldNavigate) {
            const destination = direction > 0 ? -width : width;
            Animated.timing(translateX, {
              toValue: destination,
              duration: 190,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (!finished) return;
              router.replace(tabOrder[targetIndex] as never);
              setTimeout(() => {
                translateX.setValue(0);
              }, 260);
            });
            return;
          }

          Animated.spring(translateX, {
            toValue: 0,
            stiffness: 310,
            damping: 30,
            mass: 0.75,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            stiffness: 310,
            damping: 30,
            mass: 0.75,
            useNativeDriver: true,
          }).start();
        },
      }),
    [currentIndex, swipeTabs, translateX, width],
  );

  const content = scroll ? (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      nestedScrollEnabled
      overScrollMode="never"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safe, { backgroundColor: resolvedBackground }]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[
          styles.animatedPage,
          {
            backgroundColor: theme.background,
            transform: [{ translateX }],
          },
        ]}
      >
        <KeyboardAvoidingView
          style={[styles.keyboardView, { backgroundColor: theme.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          {content}
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    overflow: "hidden",
  },
  animatedPage: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.base,
    paddingBottom: spacing.xxl + 96,
  },
});
