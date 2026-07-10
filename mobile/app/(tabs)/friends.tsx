import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Avatar from "../../src/components/Avatar";
import EmptyState from "../../src/components/EmptyState";
import { FriendsSkeleton } from "../../src/components/PageSkeletons";
import Screen from "../../src/components/Screen";
import Text from "../../src/components/LocalizedText";
import { useAppSettings } from "../../src/context/useAppSettings";
import { getFriendsSummary, type Friend, type FriendsSummary } from "../../src/lib/api";
import { radius, spacing, typography } from "../../src/theme/tokens";

const emptySummary: FriendsSummary = { friends: [], receivedRequests: [], sentRequests: [] };
let friendsCache: FriendsSummary | null = null;

function getFriendLabel(friend: Friend) {
  return friend.name || friend.email.split("@")[0] || friend.email;
}

function getFriendDays(friend: Friend) {
  if (typeof friend.friendship_days === "number") {
    return `Friends for ${friend.friendship_days} day${friend.friendship_days === 1 ? "" : "s"}`;
  }
  return "SplitVerse friend";
}

export default function FriendsPage() {
  const { theme } = useAppSettings();
  const [summary, setSummary] = useState<FriendsSummary>(friendsCache ?? emptySummary);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(!friendsCache);

  const visibleFriends = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return summary.friends;
    return summary.friends.filter((friend) => `${friend.name ?? ""} ${friend.email}`.toLowerCase().includes(value));
  }, [search, summary.friends]);

  const loadFriends = useCallback(async (silent = false) => {
    try {
      if (!silent && !friendsCache) setLoading(true);
      const data = await getFriendsSummary();
      friendsCache = data;
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFriends(Boolean(friendsCache));
    }, [loadFriends]),
  );

  if (loading && !friendsCache) {
    return (
      <Screen scroll={false}>
        <FriendsSkeleton />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={() => loadFriends(false)} contentStyle={[styles.screen, { backgroundColor: theme.background }]}> 
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back" style={[styles.backButton, { backgroundColor: theme.surfaceStrong }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color={theme.primary} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>Friends</Text>
        <Text style={[styles.title, { color: theme.text }]}>Friend list</Text>
        <Text style={[styles.subtitle, { color: theme.body }]}>Search people you already split with.</Text>
      </View>

      <AppCard style={styles.card}>
        <AppTextInput label="Search friends" value={search} onChangeText={setSearch} autoCapitalize="none" placeholder="Search by name or email" />

        {summary.friends.length === 0 ? (
          <EmptyState title="No friends yet" message="Send or accept a friend request from Profile." />
        ) : visibleFriends.length === 0 ? (
          <EmptyState title="No matching friends" />
        ) : (
          <View style={styles.list}>
            {visibleFriends.map((friend) => (
              <View style={[styles.friendRow, { borderColor: theme.border, backgroundColor: theme.surface }]} key={friend.id}>
                <Avatar name={friend.name} email={friend.email} imageUrl={friend.display_photo_url || friend.profile_photo_url || friend.photo_url} size={48} />
                <View style={styles.copy}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{getFriendLabel(friend)}</Text>
                  <Text style={[styles.meta, { color: theme.body }]} numberOfLines={1}>{getFriendDays(friend)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <AppButton title="Send or accept requests" variant="secondary" onPress={() => router.push("/(tabs)/profile")} />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.base },
  topBar: { paddingTop: spacing.sm },
  backButton: { width: 42, height: 42, alignSelf: "flex-start", alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  backText: { ...typography.caption },
  header: { gap: spacing.xs },
  eyebrow: { ...typography.caption },
  title: { ...typography.titleLg },
  subtitle: { ...typography.bodySm },
  card: { gap: spacing.base },
  list: { gap: spacing.sm },
  friendRow: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm },
  copy: { flex: 1, minWidth: 0 },
  name: { ...typography.titleSm },
  meta: { marginTop: 2, ...typography.bodySm },
});
