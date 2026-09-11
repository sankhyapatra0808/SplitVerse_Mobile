import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing } from "../theme/tokens";
import Text from "./LocalizedText";

const iconMap: Record<
  string,
  {
    inactive: keyof typeof Ionicons.glyphMap;
    active: keyof typeof Ionicons.glyphMap;
    label: string;
  }
> = {
  dashboard: { inactive: "home-outline", active: "home", label: "Home" },
  "split-rooms": {
    inactive: "receipt-outline",
    active: "receipt",
    label: "Rooms",
  },
  wallet: { inactive: "wallet-outline", active: "wallet", label: "Wallet" },
  profile: { inactive: "person-outline", active: "person", label: "Profile" },
};

export default function AnimatedTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { theme } = useAppSettings();
  const insets = useSafeAreaInsets();
  const visibleRoutes = useMemo(
    () => state.routes.filter((route) => Boolean(iconMap[route.name])),
    [state.routes],
  );

  const animations = useRef<Record<string, Animated.Value>>({}).current;

  visibleRoutes.forEach((route) => {
    if (!animations[route.key]) {
      animations[route.key] = new Animated.Value(
        route.key === state.routes[state.index]?.key ? 1 : 0,
      );
    }
  });

  useEffect(() => {
    visibleRoutes.forEach((route) => {
      const isFocused = state.routes[state.index]?.key === route.key;

      animations[route.key].stopAnimation();
      Animated.timing(animations[route.key], {
        toValue: isFocused ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
        isInteraction: false,
      }).start();
    });
  }, [animations, state.index, state.routes, visibleRoutes]);

  const isDark = theme.mode === "dark";
  const barBackground = isDark ? theme.background : theme.canvas;
  const barBorder = isDark ? "rgba(255,255,255,0.10)" : theme.primary;
  const inactiveColor = isDark ? "rgba(255,255,255,0.92)" : theme.text;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          backgroundColor: theme.background,
          borderTopColor: "transparent",
          paddingBottom: Math.max(
            insets.bottom,
            Platform.OS === "ios" ? spacing.sm : spacing.xs,
          ),
        },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            borderColor: barBorder,
            backgroundColor: barBackground,
            shadowOpacity: isDark ? 0.28 : 0.08,
          },
        ]}
      >
        {visibleRoutes.map((route) => {
          const options = descriptors[route.key]?.options;
          const isFocused = state.routes[state.index]?.key === route.key;
          const icon = iconMap[route.name];
          const animatedValue = animations[route.key];

          const itemWidth = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [52, 126],
          });
          const activeOpacity = animatedValue;
          const inactiveOpacity = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          });
          const activeScale = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1],
          });
          const inactiveScale = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.88],
          });
          const activeTranslate = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [6, 0],
          });

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Animated.View
              key={route.key}
              style={[styles.itemShell, { width: itemWidth }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={
                  options.tabBarAccessibilityLabel || icon.label
                }
                android_ripple={{
                  color: isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,82,255,0.10)",
                  borderless: true,
                  radius: 34,
                }}
                onPress={onPress}
                style={styles.itemPressable}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.activePill,
                    {
                      backgroundColor: theme.primary,
                      opacity: activeOpacity,
                      transform: [
                        { scale: activeScale },
                        { translateY: activeTranslate },
                      ],
                    },
                  ]}
                >
                  <Ionicons
                    name={icon.active}
                    size={18}
                    color={theme.onPrimary}
                  />
                  <Text
                    style={[styles.activeLabel, { color: theme.onPrimary }]}
                    numberOfLines={1}
                  >
                    {icon.label}
                  </Text>
                </Animated.View>

                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.inactiveIcon,
                    {
                      borderColor: "transparent",
                      opacity: inactiveOpacity,
                      transform: [{ scale: inactiveScale }],
                    },
                  ]}
                >
                  <Ionicons
                    name={icon.inactive}
                    size={22}
                    color={inactiveColor}
                  />
                </Animated.View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.base,
    paddingTop: 10,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    paddingBottom: Platform.OS === "ios" ? spacing.sm : spacing.xs,
  },

  bar: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 0,
    borderRadius: 34,
    paddingHorizontal: spacing.xs,
    shadowColor: "transparent",
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  itemShell: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  itemPressable: {
    width: "100%",
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  activePill: {
    position: "absolute",
    minWidth: 112,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.base,
  },
  activeLabel: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  inactiveIcon: {
    position: "absolute",
    width: 44,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: radius.pill,
  },
});
