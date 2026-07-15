import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius } from "../theme/tokens";

type SkeletonLineProps = {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonLine({
  width = "100%",
  height = 14,
  style,
}: SkeletonLineProps) {
  const { theme } = useAppSettings();
  return (
    <View
      style={[
        styles.line,
        {
          width,
          height,
          backgroundColor:
            theme.mode === "dark"
              ? "rgba(255,255,255,0.10)"
              : theme.surfaceStrong,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    overflow: "hidden",
    borderRadius: radius.pill,
  },
});
