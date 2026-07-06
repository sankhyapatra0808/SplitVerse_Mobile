import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import Avatar from "../../src/components/Avatar";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function Profile() {
  const { user, dbUser, logout } = useAuth();

  const displayName =
    dbUser?.display_name || dbUser?.name || user?.displayName || "SplitVerse user";

  const email = dbUser?.email || user?.email || "";
  const username = dbUser?.username ? `@${dbUser.username}` : "Username coming soon";

  return (
    <Screen>
      <View style={styles.profileHead}>
        <Avatar
          name={displayName}
          email={email}
          imageUrl={
            dbUser?.display_photo_url ||
            dbUser?.profile_photo_url ||
            dbUser?.photo_url
          }
          size={86}
        />

        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Friends and people</Text>
        <Text style={styles.cardText}>
          Friend list, requests, global people search, and invites will live here.
        </Text>

        <AppButton
          title="Open friends"
          onPress={() => router.push("/(tabs)/friends")}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>App settings</Text>
        <Text style={styles.cardText}>
          Profile settings, privacy, currency, wallet PIN, and account controls.
        </Text>

        <AppButton
          title="Open settings"
          variant="secondary"
          onPress={() => router.push("/(tabs)/settings")}
        />
      </AppCard>

      <AppButton title="Logout" variant="secondary" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileHead: {
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  name: {
    marginTop: spacing.sm,
    color: colors.ink,
    ...typography.titleMd,
  },
  username: {
    color: colors.primary,
    ...typography.bodySm,
  },
  email: {
    color: colors.body,
    ...typography.bodySm,
  },
  card: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    color: colors.ink,
    ...typography.titleMd,
  },
  cardText: {
    color: colors.body,
    ...typography.bodySm,
  },
});