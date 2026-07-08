import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
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
  "split-rooms": { inactive: "receipt-outline", active: "receipt", label: "Rooms" },
  wallet: { inactive: "wallet-outline", active: "wallet", label: "Wallet" },
  profile: { inactive: "person-outline", active: "person", label: "Profile" },
};

export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useAppSettings();
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

      Animated.timing(animations[route.key], {
        toValue: isFocused ? 1 : 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [animations, state.index, state.routes, visibleRoutes]);

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.background }]}> 
      <View
        style={[
          styles.bar,
          {
            borderColor: theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.10)",
            backgroundColor: theme.mode === "dark" ? "#050608" : "#0a0b0d",
            shadowOpacity: theme.mode === "dark" ? 0.34 : 0.14,
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
            outputRange: [54, 126],
          });
          const activeOpacity = animatedValue;
          const inactiveOpacity = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          });
          const activeScale = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1],
          });
          const inactiveScale = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.86],
          });
          const activeTranslate = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [8, 0],
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
            <Animated.View key={route.key} style={[styles.itemShell, { width: itemWidth }]}> 
              <Pressable
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                android_ripple={{ color: "rgba(255,255,255,0.10)", borderless: true, radius: 34 }}
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
                      transform: [{ scale: activeScale }, { translateY: activeTranslate }],
                    },
                  ]}
                >
                  <Ionicons
                    name={icon.active}
                    size={theme.mode === "dark" ? 18 : 17}
                    color={theme.onPrimary}
                  />
                  <Text
                    style={[
                      styles.activeLabel,
                      { color: theme.onPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {icon.label}
                  </Text>
                </Animated.View>

                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.inactiveIcon,
                    { opacity: inactiveOpacity, transform: [{ scale: inactiveScale }] },
                  ]}
                >
                  <Ionicons name={icon.inactive} size={22} color="rgba(255,255,255,0.92)" />
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
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === "ios" ? spacing.sm : spacing.xs,
  },
  bar: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 34,
    paddingHorizontal: spacing.xs,
    shadowColor: "#000",
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  itemShell: {
    height: 50,
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
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  inactiveIcon: {
    position: "absolute",
    width: 44,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
});
