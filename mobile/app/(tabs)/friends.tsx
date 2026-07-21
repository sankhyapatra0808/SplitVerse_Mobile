import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  BackHandler,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Avatar from "../../src/components/Avatar";
import EmptyState from "../../src/components/EmptyState";
import { FriendsSkeleton } from "../../src/components/PageSkeletons";
import Screen from "../../src/components/Screen";
import Text from "../../src/components/LocalizedText";
import { useAppSettings } from "../../src/context/useAppSettings";
import {
  blockFriend,
  getFriendsSummary,
  type Friend,
  type FriendsSummary,
} from "../../src/lib/api";
import { showErrorAlert } from "../../src/lib/errors";
import { radius, spacing, typography } from "../../src/theme/tokens";

const emptySummary: FriendsSummary = {
  friends: [],
  receivedRequests: [],
  sentRequests: [],
};

let friendsCache: FriendsSummary | null = null;

function getFriendLabel(friend: Friend) {
  return friend.name || friend.email.split("@")[0] || friend.email;
}

function getFriendDays(friend: Friend) {
  if (typeof friend.friendship_days === "number") {
    return `Friends for ${friend.friendship_days} day${
      friend.friendship_days === 1 ? "" : "s"
    }`;
  }

  return "SplitVerse friend";
}

export default function FriendsPage() {
  const { theme } = useAppSettings();
  const [summary, setSummary] = useState<FriendsSummary>(
    friendsCache ?? emptySummary,
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(!friendsCache);
  const [blockingId, setBlockingId] = useState("");

  const visibleFriends = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return summary.friends;

    return summary.friends.filter((friend) =>
      `${friend.name ?? ""} ${friend.email}`.toLowerCase().includes(value),
    );
  }, [search, summary.friends]);

  const loadFriends = useCallback(async (silent = false) => {
    try {
      if (!silent && !friendsCache) setLoading(true);
      const data = await getFriendsSummary();
      friendsCache = data;
      setSummary(data);
    } catch (error) {
      if (!silent) {
        showErrorAlert(error, {
          title: "Could not load friends",
          fallbackMessage:
            "Your friend list could not be loaded. Pull down to try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFriends(Boolean(friendsCache));
    }, [loadFriends]),
  );

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          router.replace("/(tabs)/profile");
          return true;
        },
      );

      return () => subscription.remove();
    }, []),
  );

  async function handleBlockFriend(friend: Friend) {
    Alert.alert(
      "Block friend?",
      `Block ${getFriendLabel(friend)}? This removes the friendship and stops new requests until you unblock them.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setBlockingId(friend.id);
                await blockFriend(friend.id);
                const nextSummary = {
                  ...summary,
                  friends: summary.friends.filter((item) => item.id !== friend.id),
                };
                friendsCache = nextSummary;
                setSummary(nextSummary);
              } catch (error) {
                showErrorAlert(error, {
                  title: "Could not block friend",
                  fallbackMessage: "This friend could not be blocked. Please try again.",
                });
              } finally {
                setBlockingId("");
              }
            })();
          },
        },
      ],
    );
  }

  if (loading && !friendsCache) {
    return (
      <Screen scroll={false}>
        <FriendsSkeleton />
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={loading}
      safeBackgroundColor={
        theme.mode === "dark" ? theme.background : theme.primary
      }
      onRefresh={() => loadFriends(false)}
      contentStyle={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back to profile"
          style={[styles.backButton, { backgroundColor: theme.surfaceStrong }]}
          onPress={() => router.replace("/(tabs)/profile")}
        >
          <Ionicons name="chevron-back" size={21} color={theme.primary} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>Friends</Text>
        <Text style={[styles.title, { color: theme.text }]}>Friend list</Text>
        <Text style={[styles.subtitle, { color: theme.body }]}>
          Search people you already split with.
        </Text>
      </View>

      <AppCard style={styles.card}>
        <AppTextInput
          label="Search friends"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          placeholder="Search by name or email"
        />

        {summary.friends.length === 0 ? (
          <EmptyState
            title="No friends yet"
            message="Send or accept a friend request from Profile."
          />
        ) : visibleFriends.length === 0 ? (
          <EmptyState title="No matching friends" />
        ) : (
          <ScrollView
            style={
              visibleFriends.length > 4 ? styles.friendListViewport : undefined
            }
            contentContainerStyle={styles.list}
            nestedScrollEnabled
            scrollEnabled={visibleFriends.length > 4}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {visibleFriends.map((friend) => (
              <View
                style={[
                  styles.friendRow,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                  },
                ]}
                key={friend.id}
              >
                <Avatar
                  name={friend.name}
                  email={friend.email}
                  imageUrl={
                    friend.display_photo_url ||
                    friend.profile_photo_url ||
                    friend.photo_url
                  }
                  size={48}
                />

                <View style={styles.copy}>
                  <Text
                    style={[styles.name, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {getFriendLabel(friend)}
                  </Text>
                  <Text
                    style={[styles.meta, { color: theme.body }]}
                    numberOfLines={1}
                  >
                    {friend.username ? `@${friend.username} · ` : ""}
                    {getFriendDays(friend)}
                  </Text>
                </View>

                <AppButton
                  title={blockingId === friend.id ? "Blocking" : "Block"}
                  loading={blockingId === friend.id}
                  variant="secondary"
                  style={styles.blockButton}
                  onPress={() => handleBlockFriend(friend)}
                />
              </View>
            ))}
          </ScrollView>
        )}

        <AppButton
          title="Send or accept requests"
          variant="secondary"
          onPress={() => router.push("/(tabs)/profile")}
        />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.base },
  topBar: { paddingTop: spacing.sm },
  backButton: {
    width: 42,
    height: 42,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  backText: { ...typography.caption },
  header: { gap: spacing.xs },
  eyebrow: { ...typography.caption },
  title: { ...typography.titleLg },
  subtitle: { ...typography.bodySm },
  card: { gap: spacing.base },
  list: { gap: spacing.sm },
  friendListViewport: {
    maxHeight: 4 * 74 + 4 * spacing.sm,
  },
  friendRow: {
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
  blockButton: {
    minWidth: 82,
    maxWidth: 104,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
});
