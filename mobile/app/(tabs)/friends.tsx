import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Screen from "../../src/components/Screen";
import {
  acceptFriendRequest,
  getFriendActivity,
  getFriendsSummary,
  sendFriendRequest,
  type Friend,
  type FriendActivityResponse,
  type FriendsSummary,
} from "../../src/lib/api";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

const emptySummary: FriendsSummary = {
  friends: [],
  receivedRequests: [],
  sentRequests: [],
};

function getFriendLabel(friend: Friend) {
  return friend.name || friend.email.split("@")[0] || friend.email;
}

function getInitials(name: string | null, email: string) {
  const source = name || email.split("@")[0] || "SV";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "S";
  const second =
    parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1] || "V";

  return `${first}${second}`.toUpperCase();
}

function formatMoney(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

export default function Friends() {
  const [summary, setSummary] = useState<FriendsSummary>(emptySummary);
  const [friendEmail, setFriendEmail] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [acceptingId, setAcceptingId] = useState("");
  const [activityLoadingId, setActivityLoadingId] = useState("");
  const [activity, setActivity] = useState<FriendActivityResponse | null>(null);

  const pendingReceivedRequests = summary.receivedRequests.filter(
    (request) => request.status === "pending",
  );

  const pendingSentRequests = summary.sentRequests.filter(
    (request) => request.status === "pending",
  );

  const visibleFriends = useMemo(() => {
    const search = friendSearch.trim().toLowerCase();

    if (!search) {
      return summary.friends;
    }

    return summary.friends.filter((friend) =>
      `${friend.name ?? ""} ${friend.email}`.toLowerCase().includes(search),
    );
  }, [friendSearch, summary.friends]);

  async function loadFriends() {
    try {
      setLoading(true);
      const data = await getFriendsSummary();
      setSummary(data);
    } catch (error) {
      Alert.alert(
        "Friends failed",
        error instanceof Error ? error.message : "Could not load friends",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFriends();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFriends();
    }, []),
  );

  async function handleSendRequest() {
    const email = friendEmail.trim().toLowerCase();

    if (!email) {
      Alert.alert("Missing email", "Enter your friend's email.");
      return;
    }

    try {
      setSending(true);
      await sendFriendRequest(email);
      setFriendEmail("");
      await loadFriends();
      Alert.alert("Request sent", "Friend request created.");
    } catch (error) {
      Alert.alert(
        "Request failed",
        error instanceof Error ? error.message : "Could not send request",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleAccept(requestId: string) {
    try {
      setAcceptingId(requestId);
      await acceptFriendRequest(requestId);
      await loadFriends();
      Alert.alert("Accepted", "Friend request accepted.");
    } catch (error) {
      Alert.alert(
        "Accept failed",
        error instanceof Error ? error.message : "Could not accept request",
      );
    } finally {
      setAcceptingId("");
    }
  }

  async function handleActivity(friendId: string) {
    try {
      setActivityLoadingId(friendId);
      const data = await getFriendActivity(friendId);
      setActivity(data);
    } catch (error) {
      Alert.alert(
        "Activity failed",
        error instanceof Error ? error.message : "Could not load activity",
      );
    } finally {
      setActivityLoadingId("");
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>People you split with</Text>
        <Text style={styles.title}>Friends</Text>
        <Text style={styles.subtitle}>
          Add friends by email, accept incoming requests, and view shared
          activity.
        </Text>
      </View>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Send request</Text>
        <AppTextInput
          label="Friend email"
          value={friendEmail}
          onChangeText={setFriendEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="friend@example.com"
          editable={!sending}
        />
        <AppButton
          title="Send request"
          loading={sending}
          onPress={handleSendRequest}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Friend list</Text>
        <AppTextInput
          label="Search friends"
          value={friendSearch}
          onChangeText={setFriendSearch}
          placeholder="Search by name or email"
          autoCapitalize="none"
        />

        {loading ? (
          <Text style={styles.muted}>Loading friends...</Text>
        ) : summary.friends.length === 0 ? (
          <Text style={styles.muted}>No friends yet.</Text>
        ) : visibleFriends.length === 0 ? (
          <Text style={styles.muted}>No friends match your search.</Text>
        ) : (
          <View style={styles.list}>
            {visibleFriends.map((friend) => (
              <View style={styles.friendRow} key={friend.id}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getInitials(friend.name, friend.email)}
                  </Text>
                </View>

                <View style={styles.friendInfo}>
                  <Text style={styles.friendName} numberOfLines={1}>
                    {getFriendLabel(friend)}
                  </Text>
                  <Text style={styles.friendEmail} numberOfLines={1}>
                    {friend.email}
                  </Text>
                </View>

                <AppButton
                  title={
                    activityLoadingId === friend.id ? "Loading" : "Activity"
                  }
                  onPress={() => handleActivity(friend.id)}
                  loading={activityLoadingId === friend.id}
                  style={styles.activityButton}
                />
              </View>
            ))}
          </View>
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Requests to accept</Text>

        {pendingReceivedRequests.length === 0 ? (
          <Text style={styles.muted}>No pending received requests.</Text>
        ) : (
          <View style={styles.list}>
            {pendingReceivedRequests.map((request) => (
              <View style={styles.requestRow} key={request.id}>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName} numberOfLines={1}>
                    {request.requester_name || request.requester_email}
                  </Text>
                  <Text style={styles.friendEmail} numberOfLines={1}>
                    {request.requester_email}
                  </Text>
                </View>

                <AppButton
                  title={acceptingId === request.id ? "Accepting" : "Accept"}
                  loading={acceptingId === request.id}
                  onPress={() => handleAccept(request.id)}
                  style={styles.acceptButton}
                />
              </View>
            ))}
          </View>
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Email invites</Text>

        {pendingSentRequests.length === 0 ? (
          <Text style={styles.muted}>No sent requests.</Text>
        ) : (
          <View style={styles.list}>
            {pendingSentRequests.map((request) => (
              <View style={styles.requestRow} key={request.id}>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName} numberOfLines={1}>
                    {request.recipient_email}
                  </Text>
                  <Text style={styles.friendEmail}>Waiting for acceptance</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </AppCard>

      <AppButton
        title="Refresh friends"
        variant="secondary"
        onPress={loadFriends}
        loading={loading}
      />

      <Modal
        visible={Boolean(activity)}
        transparent
        animationType="fade"
        onRequestClose={() => setActivity(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Friend activity</Text>
            <Text style={styles.modalTitle}>
              {activity?.friend.name || activity?.friend.email}
            </Text>

            <View style={styles.activityGrid}>
              <View style={styles.activityStat}>
                <Text style={styles.statLabel}>Rooms</Text>
                <Text style={styles.statValue}>
                  {activity?.summary.roomsTogether ?? 0}
                </Text>
              </View>

              <View style={styles.activityStat}>
                <Text style={styles.statLabel}>Settled</Text>
                <Text style={styles.statValue}>
                  {formatMoney(activity?.summary.totalSettled ?? 0)}
                </Text>
              </View>

              <View style={styles.activityStat}>
                <Text style={styles.statLabel}>Net</Text>
                <Text style={styles.statValue}>
                  {formatMoney(activity?.summary.netPosition ?? 0)}
                </Text>
              </View>
            </View>

            {activity?.recentActivity.length ? (
              <View style={styles.list}>
                {activity.recentActivity.slice(0, 5).map((item) => (
                  <View style={styles.activityRow} key={item.id}>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{item.title}</Text>
                      <Text style={styles.friendEmail}>{item.source}</Text>
                    </View>
                    <Text style={styles.amount}>
                      {formatMoney(item.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>No shared activity yet.</Text>
            )}

            <Pressable
              style={styles.closeButton}
              onPress={() => setActivity(null)}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    paddingTop: spacing.xl,
  },
  eyebrow: {
    color: colors.primary,
    ...typography.caption,
  },
  title: {
    color: colors.ink,
    ...typography.titleLg,
  },
  subtitle: {
    color: colors.body,
    ...typography.body,
  },
  card: {
    gap: spacing.base,
    marginTop: spacing.lg,
  },
  cardTitle: {
    color: colors.ink,
    ...typography.titleMd,
  },
  muted: {
    color: colors.body,
    ...typography.bodySm,
  },
  list: {
    gap: spacing.sm,
  },
  friendRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  requestRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceDark,
  },
  avatarText: {
    color: colors.onDark,
    ...typography.caption,
  },
  friendInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  friendName: {
    color: colors.ink,
    ...typography.titleSm,
  },
  friendEmail: {
    color: colors.body,
    ...typography.bodySm,
  },
  activityButton: {
    minWidth: 98,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  acceptButton: {
    minWidth: 92,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(10, 11, 13, 0.45)",
    padding: spacing.base,
  },
  modalCard: {
    gap: spacing.base,
    borderRadius: radius.xl,
    backgroundColor: colors.canvas,
    padding: spacing.lg,
  },
  modalEyebrow: {
    color: colors.body,
    ...typography.caption,
  },
  modalTitle: {
    color: colors.ink,
    ...typography.titleMd,
  },
  activityGrid: {
    gap: spacing.sm,
  },
  activityStat: {
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  statLabel: {
    color: colors.body,
    ...typography.caption,
  },
  statValue: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  amount: {
    color: colors.primary,
    fontWeight: "700",
  },
  closeButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
  },
  closeText: {
    color: colors.ink,
    ...typography.button,
  },
});
