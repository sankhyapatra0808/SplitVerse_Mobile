import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { memo, useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

export type AppToastPayload = {
  id: string;
  title: string;
  message: string;
  imageUrl?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
};

type AppToastProps = {
  toast: AppToastPayload | null;
  onHide: () => void;
};

function AppToast({ toast, onHide }: AppToastProps) {
  const { theme } = useAppSettings();
  const insets = useSafeAreaInsets();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!toast) return;

    anim.stopAnimation();
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 210,
      mass: 0.72,
      isInteraction: false,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 135,
        useNativeDriver: true,
        isInteraction: false,
      }).start(onHide);
    }, 3200);

    return () => {
      clearTimeout(timer);
      anim.stopAnimation();
    };
  }, [anim, onHide, toast]);

  if (!toast) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-46, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingTop: Math.max(insets.top + 10, 22),
          opacity: anim,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Pressable
        accessibilityRole={toast.onPress ? "button" : "alert"}
        accessibilityLabel={`${toast.title}. ${toast.message}`}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: "rgba(28,30,36,0.96)",
            borderColor: "rgba(255,255,255,0.07)",
            transform: [{ scale: pressed && toast.onPress ? 0.985 : 1 }],
          },
        ]}
        onPress={
          toast.onPress
            ? () => {
                toast.onPress?.();
                onHide();
              }
            : undefined
        }
        disabled={!toast.onPress}
      >
        {toast.imageUrl ? (
          <Image
            source={toast.imageUrl}
            cachePolicy="memory-disk"
            contentFit="cover"
            recyclingKey={toast.imageUrl}
            style={styles.avatar}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.iconAvatar,
              { backgroundColor: "#061338" },
            ]}
          >
            {toast.icon ? (
              <Ionicons
                name={toast.icon}
                size={28}
                color={theme.mode === "dark" ? theme.primary : "#54a9ff"}
              />
            ) : (
              <Text
                style={[
                  styles.fallbackLetter,
                  {
                    color: theme.mode === "dark" ? theme.primary : "#54a9ff",
                  },
                ]}
              >
                S
              </Text>
            )}
          </View>
        )}

        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {toast.title}
          </Text>
          <Text style={styles.message} numberOfLines={1}>
            {toast.message}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default memo(AppToast);

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: spacing.base,
  },
  card: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: spacing.base,
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  iconAvatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackLetter: {
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 38,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#ffffff",
    ...typography.titleSm,
  },
  message: {
    marginTop: 2,
    color: "rgba(255,255,255,0.92)",
    ...typography.bodySm,
  },
});
