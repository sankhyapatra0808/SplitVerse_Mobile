import { memo, useMemo } from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius, typography } from "../theme/tokens";
import Text from "./LocalizedText";

type AvatarProps = {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
  size?: number;
};

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email?.split("@")[0] || "SV";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "S";
  const second =
    parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1] || "V";
  return `${first}${second}`.toUpperCase();
}

function Avatar({ name, email, imageUrl, size = 44 }: AvatarProps) {
  const { theme } = useAppSettings();
  const avatarStyle = useMemo(
    () => ({ width: size, height: size, borderRadius: radius.full }),
    [size],
  );

  if (imageUrl) {
    return (
      <Image
        source={imageUrl}
        accessibilityLabel={name || email || "Profile photo"}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={100}
        recyclingKey={imageUrl}
        style={[
          styles.avatar,
          {
            borderColor: theme.border,
            backgroundColor: theme.surfaceStrong,
          },
          avatarStyle,
        ]}
      />
    );
  }

  return (
    <View
      accessibilityLabel={name || email || "Profile avatar"}
      style={[
        styles.avatar,
        styles.initialsAvatar,
        { borderColor: theme.border, backgroundColor: theme.primary },
        avatarStyle,
      ]}
    >
      <Text style={[styles.initialsText, { color: theme.onPrimary }]}>
        {getInitials(name, email)}
      </Text>
    </View>
  );
}

export default memo(Avatar);

const styles = StyleSheet.create({
  avatar: {
    borderWidth: 1,
    overflow: "hidden",
  },
  initialsAvatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    ...typography.caption,
    includeFontPadding: false,
    textAlign: "center",
    textAlignVertical: "center",
  },
});
