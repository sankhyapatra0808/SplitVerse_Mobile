import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Avatar from "../../src/components/Avatar";
import EmptyState from "../../src/components/EmptyState";
import { InlineListSkeleton } from "../../src/components/PageSkeletons";
import Screen from "../../src/components/Screen";
import Text from "../../src/components/LocalizedText";
import { useAppSettings } from "../../src/context/useAppSettings";
import {
  getBlockedUsers,
  unblockUser,
  type BlockedUser,
} from "../../src/lib/api";
import { showErrorAlert } from "../../src/lib/errors";
import { radius, spacing, typography } from "../../src/theme/tokens";

function getUserLabel(user: BlockedUser) {
  return user.name || (user.username ? `@${user.username}` : user.email);
}

export default function BlockedUsers() {
  const { theme } = useAppSettings();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState("");

  const visibleUsers = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return blockedUsers;
    return blockedUsers.filter((user) =>
      `${user.name || ""} ${user.username || ""} ${user.email}`
        .toLowerCase()
        .includes(value),
    );
  }, [blockedUsers, search]);

  const loadBlockedUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getBlockedUsers();
      setBlockedUsers(response.blockedUsers ?? []);
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not load blocked people",
        fallbackMessage: "The blocked list could not be loaded. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBlockedUsers();
    }, [loadBlockedUsers]),
  );

  async function handleUnblock(user: BlockedUser) {
    try {
      setUnblockingId(user.id);
      await unblockUser(user.id);
      setBlockedUsers((current) => current.filter((item) => item.id !== user.id));
      Alert.alert("User unblocked", `${getUserLabel(user)} can contact you again.`);
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not unblock user",
        fallbackMessage: "This user could not be unblocked. Please try again.",
      });
    } finally {
      setUnblockingId("");
    }
  }

  return (
    <Screen
      refreshing={loading}
      onRefresh={loadBlockedUsers}
      safeBackgroundColor={theme.mode === "dark" ? theme.background : theme.primary}
      contentStyle={[styles.screen, { backgroundColor: theme.background }]}
    >
      <Pressable
        accessibilityLabel="Back to settings"
        style={[styles.backButton, { backgroundColor: theme.surfaceStrong }]}
        onPress={() => router.replace("/(tabs)/settings")}
      >
        <Ionicons name="chevron-back" size={21} color={theme.primary} />
      </Pressable>

      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>Safety</Text>
        <Text style={[styles.title, { color: theme.text }]}>Blocked people</Text>
        <Text style={[styles.subtitle, { color: theme.body }]}>Only people you have blocked appear here.</Text>
      </View>

      <AppCard style={styles.card}>
        <AppTextInput
          label="Search blocked people"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          placeholder="Name, username, or email"
        />

        {loading ? (
          <InlineListSkeleton rows={3} />
        ) : blockedUsers.length === 0 ? (
          <EmptyState title="No blocked people" message="People you block will appear here." />
        ) : visibleUsers.length === 0 ? (
          <EmptyState title="No matching blocked people" />
        ) : (
          <ScrollView
            style={visibleUsers.length > 4 ? styles.listViewport : undefined}
            contentContainerStyle={styles.list}
            scrollEnabled={visibleUsers.length > 4}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {visibleUsers.map((user) => (
              <View
                key={user.id}
                style={[
                  styles.row,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                ]}
              >
                <Avatar
                  name={user.name}
                  email={user.email}
                  imageUrl={
                    user.display_photo_url ||
                    user.profile_photo_url ||
                    user.photo_url
                  }
                  size={46}
                />
                <View style={styles.copy}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {getUserLabel(user)}
                  </Text>
                  <Text style={[styles.meta, { color: theme.body }]} numberOfLines={1}>
                    {user.username ? `@${user.username}` : user.email}
                  </Text>
                </View>
                <AppButton
                  title={unblockingId === user.id ? "Unblocking" : "Unblock"}
                  loading={unblockingId === user.id}
                  variant="secondary"
                  style={styles.action}
                  onPress={() => void handleUnblock(user)}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.base },
  backButton: {
    width: 42,
    height: 42,
    marginTop: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  header: { gap: spacing.xs },
  eyebrow: { ...typography.caption },
  title: { ...typography.titleLg },
  subtitle: { ...typography.bodySm },
  card: { gap: spacing.base },
  listViewport: { maxHeight: 4 * 74 + 3 * spacing.sm, flexGrow: 0 },
  list: { gap: spacing.sm },
  row: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  copy: { flex: 1, minWidth: 0 },
  name: { ...typography.titleSm },
  meta: { marginTop: 2, ...typography.bodySm },
  action: { minWidth: 92, maxWidth: 112, minHeight: 40, paddingHorizontal: spacing.sm },
});
