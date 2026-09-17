import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import AppButton from "../src/components/AppButton";
import AppCard from "../src/components/AppCard";
import AppTextInput from "../src/components/AppTextInput";
import Avatar from "../src/components/Avatar";
import EmptyState from "../src/components/EmptyState";
import Screen from "../src/components/Screen";
import Text from "../src/components/LocalizedText";
import { useAuth } from "../src/context/AuthContext";
import { useAppSettings } from "../src/context/useAppSettings";
import {
  addSplitRoomMembers,
  getFriendsSummary,
  type Friend,
} from "../src/lib/api";
import { showErrorAlert } from "../src/lib/errors";
import {
  setPendingSplitRoomFriendSelection,
  type SplitRoomFriendSelectionMode,
} from "../src/lib/splitRoomFriendSelection";
import { radius, spacing, typography } from "../src/theme/tokens";

function getFriendName(friend: Friend) {
  return friend.name || friend.email.split("@")[0] || friend.email;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseSelectedEmails(value: string | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => String(entry ?? "").trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export default function SplitRoomFriendPicker() {
  const params = useLocalSearchParams<{
    roomId?: string | string[];
    mode?: string | string[];
    selectedEmails?: string | string[];
  }>();
  const { user, dbUser } = useAuth();
  const { theme } = useAppSettings();

  const roomId = firstParam(params.roomId) ?? "";
  const rawMode = firstParam(params.mode);
  const mode: SplitRoomFriendSelectionMode =
    rawMode === "automatic" ? "automatic" : "assign";
  const initialSelectedEmails = useMemo(
    () => parseSelectedEmails(firstParam(params.selectedEmails)),
    [params.selectedEmails],
  );

  const selfEmail = (dbUser?.email || user?.email || "").trim().toLowerCase();
  const selfName = dbUser?.name || user?.displayName || "Me";
  const selfPhoto =
    dbUser?.display_photo_url ||
    dbUser?.profile_photo_url ||
    dbUser?.photo_url ||
    user?.photoURL ||
    undefined;

  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>(
    initialSelectedEmails,
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadFriends = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getFriendsSummary();
      setFriends(result.friends ?? []);
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not load friends",
        fallbackMessage: "Your friends could not be loaded. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFriends();

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          router.back();
          return true;
        },
      );

      return () => subscription.remove();
    }, [loadFriends]),
  );

  const visibleFriends = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return friends;

    return friends.filter((friend) =>
      `${friend.name ?? ""} ${friend.email}`.toLowerCase().includes(value),
    );
  }, [friends, search]);

  function toggleEmail(emailValue: string) {
    const email = emailValue.trim().toLowerCase();
    if (!email) return;

    if (mode === "assign") {
      setSelectedEmails([email]);
      return;
    }

    setSelectedEmails((current) =>
      current.includes(email)
        ? current.filter((entry) => entry !== email)
        : [...current, email],
    );
  }

  async function handleConfirm() {
    if (!roomId) {
      router.back();
      return;
    }

    if (selectedEmails.length === 0) {
      return;
    }

    try {
      setSaving(true);
      const friendEmails = selectedEmails.filter(
        (email) => email.toLowerCase() !== selfEmail,
      );

      if (friendEmails.length > 0) {
        await addSplitRoomMembers(roomId, friendEmails);
      }

      setPendingSplitRoomFriendSelection({
        roomId,
        mode,
        selectedEmails,
      });
      router.back();
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not update room",
        fallbackMessage:
          "The selected friends could not be added to this room. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = selectedEmails.length;

  return (
    <Screen
      swipeTabs={false}
      safeBackgroundColor={theme.background}
      contentStyle={styles.screen}
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to split room"
          style={[
            styles.backButton,
            { borderColor: theme.border, backgroundColor: theme.surfaceStrong },
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={theme.primary} />
        </Pressable>
      </View>

      <View style={styles.heading}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>Split room</Text>
        <Text style={[styles.title, { color: theme.text }]}>
          {mode === "automatic" ? "Split between" : "Assign to"}
        </Text>
        <Text style={[styles.subtitle, { color: theme.body }]}>
          {mode === "automatic"
            ? "Choose everyone who should share this item. Selecting a friend also adds them to the room."
            : "Choose who this item belongs to. Selecting a friend also adds them to the room."}
        </Text>
      </View>

      <AppCard style={styles.card}>
        <AppTextInput
          label="Search"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          placeholder="Search friends"
          editable={!saving}
        />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.body }]}>Loading friends</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {selfEmail ? (
              <Pressable
                style={[
                  styles.personRow,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                  selectedEmails.includes(selfEmail) && {
                    borderColor: theme.primary,
                    backgroundColor: theme.primarySoft,
                  },
                ]}
                disabled={saving}
                onPress={() => toggleEmail(selfEmail)}
              >
                <Avatar
                  name={selfName}
                  email={selfEmail}
                  imageUrl={selfPhoto}
                  size={42}
                />
                <View style={styles.personCopy}>
                  <Text style={[styles.personName, { color: theme.text }]} numberOfLines={1}>
                    Me
                  </Text>
                  <Text style={[styles.personEmail, { color: theme.body }]} numberOfLines={1}>
                    {selfEmail}
                  </Text>
                </View>
                <Ionicons
                  name={
                    selectedEmails.includes(selfEmail)
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={22}
                  color={
                    selectedEmails.includes(selfEmail)
                      ? theme.primary
                      : theme.muted
                  }
                />
              </Pressable>
            ) : null}

            {visibleFriends.map((friend) => {
              const email = friend.email.trim().toLowerCase();
              const selected = selectedEmails.includes(email);

              return (
                <Pressable
                  key={friend.id}
                  style={[
                    styles.personRow,
                    { borderColor: theme.border, backgroundColor: theme.surface },
                    selected && {
                      borderColor: theme.primary,
                      backgroundColor: theme.primarySoft,
                    },
                  ]}
                  disabled={saving}
                  onPress={() => toggleEmail(email)}
                >
                  <Avatar
                    name={friend.name}
                    email={friend.email}
                    imageUrl={
                      friend.display_photo_url ||
                      friend.profile_photo_url ||
                      friend.photo_url
                    }
                    size={42}
                  />
                  <View style={styles.personCopy}>
                    <Text style={[styles.personName, { color: theme.text }]} numberOfLines={1}>
                      {getFriendName(friend)}
                    </Text>
                    <Text style={[styles.personEmail, { color: theme.body }]} numberOfLines={1}>
                      {friend.email}
                    </Text>
                  </View>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={selected ? theme.primary : theme.muted}
                  />
                </Pressable>
              );
            })}

            {friends.length === 0 ? (
              <EmptyState
                title="No friends yet"
                message="Add friends first, or choose yourself for this item."
              />
            ) : visibleFriends.length === 0 ? (
              <EmptyState title="No matching friends" />
            ) : null}
          </View>
        )}
      </AppCard>

      <View style={styles.footer}>
        <Text style={[styles.selectedText, { color: theme.body }]}>
          {mode === "automatic"
            ? `${selectedCount} selected`
            : selectedCount > 0
              ? "1 person selected"
              : "Choose one person"}
        </Text>
        <AppButton
          title={mode === "automatic" ? "Use selected people" : "Assign to selected person"}
          loading={saving}
          disabled={loading || selectedCount === 0}
          onPress={() => void handleConfirm()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.caption,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    ...typography.titleLg,
  },
  subtitle: {
    ...typography.bodySm,
    lineHeight: 21,
  },
  card: {
    gap: spacing.base,
  },
  loadingWrap: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.bodySm,
  },
  list: {
    gap: spacing.sm,
  },
  personRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  personCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  personName: {
    ...typography.titleSm,
  },
  personEmail: {
    ...typography.bodySm,
  },
  footer: {
    gap: spacing.sm,
  },
  selectedText: {
    ...typography.caption,
    textAlign: "center",
  },
});
