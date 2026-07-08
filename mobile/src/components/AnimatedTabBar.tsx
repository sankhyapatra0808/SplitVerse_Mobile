import {
  Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect,
  useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

const iconMap: Record<
  string,
  {
    inactive: keyof typeof Ionicons.glyphMap;
    active: keyof typeof Ionicons.glyphMap;
    label: string;
  }
> = {
  dashboard: {
    inactive: "home-outline",
    active: "home",
    label: "Home",
  },
  "split-rooms": {
    inactive: "receipt-outline",
    active: "receipt",
    label: "Rooms",
  },
  wallet: {
    inactive: "wallet-outline",
    active: "wallet",
    label: "Wallet",
  },
  profile: {
    inactive: "person-outline",
    active: "person",
    label: "Profile",
  },
};

export default function AnimatedTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const visibleRoutes = state.routes.filter((route) => Boolean(iconMap[route.name]));

  const animations = useRef(
    visibleRoutes.reduce<Record<string, Animated.Value>>((acc, route) => {
      acc[route.key] = new Animated.Value(route.name === state.routes[state.index]?.name ? 1 : 0);
      return acc;
    }, {}),
  ).current;

  useEffect(() => {
    visibleRoutes.forEach((route) => {
      const isFocused = state.routes[state.index]?.key === route.key;

      Animated.spring(animations[route.key], {
        toValue: isFocused ? 1 : 0,
        useNativeDriver: false,
        friction: 7,
        tension: 90,
      }).start();
    });
  }, [animations, state.index, state.routes, visibleRoutes]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const options = descriptors[route.key]?.options;
          const isFocused = state.routes[state.index]?.key === route.key;
          const icon = iconMap[route.name];

          const scale = animations[route.key].interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.08],
          });

          const circleSize = animations[route.key].interpolate({
            inputRange: [0, 1],
            outputRange: [44, 54],
          });

          const backgroundColor = animations[route.key].interpolate({
            inputRange: [0, 1],
            outputRange: [colors.canvas, colors.primary],
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
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={styles.item}
            >
              <Animated.View
                style={[
                  styles.iconCircle,
                  {
                    width: circleSize,
                    height: circleSize,
                    backgroundColor,
                    transform: [{ scale }],
                  },
                ]}
              >
                <Ionicons
                  name={isFocused ? icon.active : icon.inactive}
                  size={23}
                  color={isFocused ? colors.canvas : colors.ink}
                />
              </Animated.View>

              <Text
                style={[
                  styles.label,
                  isFocused ? styles.activeLabel : styles.inactiveLabel,
                ]}
                numberOfLines={1}
              >
                {icon.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  bar: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: 34,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  iconCircle: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
  },
  activeLabel: {
    color: colors.primary,
  },
  inactiveLabel: {
    color: colors.body,
  },
});