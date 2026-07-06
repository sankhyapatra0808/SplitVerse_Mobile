import { Image, StyleSheet, Text, View } from "react-native";
import { colors, radius, typography } from "../theme/tokens";

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

export default function Avatar({
  name,
  email,
  imageUrl,
  size = 44,
}: AvatarProps) {
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: radius.full,
  };

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.avatar, avatarStyle]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.avatar, styles.initialsAvatar, avatarStyle]}>
      <Text style={styles.initialsText}>{getInitials(name, email)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    backgroundColor: colors.surfaceStrong,
  },
  initialsAvatar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceDark,
  },
  initialsText: {
    color: colors.onDark,
    ...typography.caption,
  },
});