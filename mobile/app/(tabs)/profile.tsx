import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import AmountText from "../../src/components/AmountText";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Avatar from "../../src/components/Avatar";
import EmptyState from "../../src/components/EmptyState";
import LoadingState from "../../src/components/LoadingState";
import ProfileMetric from "../../src/components/ProfileMetric";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import SheetModal from "../../src/components/SheetModal";
import { useAuth } from "../../src/context/AuthContext";
import {
  acceptFriendRequest,
  getFriendActivity,
  getFriendsSummary,
  getSplitRooms,
  sendFriendRequest,
  getTransactions,
  type TransactionItem,
  type Friend,
  type FriendActivityResponse,
  type FriendsSummary,
  type SplitRoom,
} from "../../src/lib/api";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

const emptySummary: FriendsSummary = {
  friends: [],
  receivedRequests: [],
  sentRequests: [],
};

type ProfileTab = "account" | "friends" | "activity";

type ProfileTransaction = TransactionItem & {
  created_at?: string;
  createdAt?: string;
  displayDate?: string;
  description?: string | null;
  status?: string | null;
  roomName?: string | null;
  counterpartyName?: string | null;
  counterpartyEmail?: string | null;
};

function getFriendLabel(friend: Friend) {
  return friend.name || friend.email.split("@")[0] || friend.email;
}

function formatMoney(value?: number | null) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return "Unknown";

  const rawValue = String(dateValue);

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    const [year, month, day] = rawValue.split("-");
    return `${day}-${month}-${year}`;
  }

  const normalizedValue = rawValue.replace(" ", "T");
  const hasTimezone = /z$|[+-]\d{2}:?\d{2}$/i.test(normalizedValue);
  const date = new Date(hasTimezone ? normalizedValue : `${normalizedValue}Z`);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function getTransactionTitle(transaction: ProfileTransaction) {
  return (
    transaction.description ||
    transaction.roomName ||
    transaction.counterpartyName ||
    transaction.counterpartyEmail ||
    transaction.type ||
    "Transaction"
  );
}

function getTransactionDate(transaction: ProfileTransaction) {
  return formatDate(
    transaction.displayDate || transaction.createdAt || transaction.created_at,
  );
}

function isTransactionCredit(transaction: ProfileTransaction) {
  const type = String(transaction.type || "").toLowerCase();

  return (
    type === "credit" ||
    type === "top_up" ||
    type === "top-up" ||
    type.includes("credit") ||
    type.includes("top") ||
    Number(transaction.amount || 0) > 0
  );
}

export default function Profile() {
  const { user, dbUser, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>("account");
  const [friendsSummary, setFriendsSummary] =
    useState<FriendsSummary>(emptySummary);
  const [rooms, setRooms] = useState<SplitRoom[]>([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const [loadingProfileData, setLoadingProfileData] = useState(true);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState("");
  const [activityLoadingId, setActivityLoadingId] = useState("");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [activity, setActivity] = useState<FriendActivityResponse | null>(null);

  const displayName =
    dbUser?.display_name ||
    dbUser?.name ||
    user?.displayName ||
    "SplitVerse user";

  const email = dbUser?.email || user?.email || "";
  const username = dbUser?.username
    ? `@${dbUser.username}`
    : "Username coming soon";

  const walletBalance = Number(dbUser?.wallet_balance || 0);

  const pendingReceivedRequests = friendsSummary.receivedRequests.filter(
    (request) => request.status === "pending",
  );

  const pendingSentRequests = friendsSummary.sentRequests.filter(
    (request) => request.status === "pending",
  );

  const visibleFriends = useMemo(() => {
    const search = friendSearch.trim().toLowerCase();

    if (!search) {
      return friendsSummary.friends;
    }

    return friendsSummary.friends.filter((friend) =>
      `${friend.name ?? ""} ${friend.email}`.toLowerCase().includes(search),
    );
  }, [friendSearch, friendsSummary.friends]);

  const recentRooms = rooms.slice(0, 4);

  const loadProfileData = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoadingProfileData(true);
      }

      const [friendsData, roomsData, transactionData] = await Promise.all([
        getFriendsSummary(),
        getSplitRooms(),
        getTransactions({ limit: 20 }),
      ]);

      setFriendsSummary(friendsData);
      setRooms(roomsData.rooms);
      setTransactions(transactionData.transactions ?? []);
    } catch (error) {
      if (!silent) {
        Alert.alert(
          "Profile failed",
          error instanceof Error ? error.message : "Could not load profile",
        );
      }
    } finally {
      if (!silent) {
        setLoadingProfileData(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  useFocusEffect(
    useCallback(() => {
      void loadProfileData(true);
    }, [loadProfileData]),
  );

  useFocusEffect(
    useCallback(() => {
      const timer = window.setInterval(() => {
        void loadProfileData(true);
      }, 8000);

      return () => {
        window.clearInterval(timer);
      };
    }, [loadProfileData]),
  );

  async function handleSendRequest() {
    const targetEmail = friendEmail.trim().toLowerCase();

    if (!targetEmail) {
      Alert.alert("Missing email", "Enter your friend's email.");
      return;
    }

    try {
      setSendingRequest(true);
      await sendFriendRequest(targetEmail);
      setFriendEmail("");
      await loadProfileData(true);
      Alert.alert("Request sent", "Friend request created.");
    } catch (error) {
      Alert.alert(
        "Request failed",
        error instanceof Error ? error.message : "Could not send request",
      );
    } finally {
      setSendingRequest(false);
    }
  }

  async function handleAcceptRequest(requestId: string) {
    try {
      setAcceptingRequestId(requestId);
      await acceptFriendRequest(requestId);
      await loadProfileData(true);
      setActiveTab("friends");
      Alert.alert("Accepted", "Friend added to your friend list.");
    } catch (error) {
      Alert.alert(
        "Accept failed",
        error instanceof Error ? error.message : "Could not accept request",
      );
    } finally {
      setAcceptingRequestId("");
    }
  }

  async function handleOpenActivity(friendId: string) {
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
    <Screen
      refreshing={loadingProfileData}
      onRefresh={() => loadProfileData()}
      contentStyle={styles.screen}
    >
      <View style={styles.topBar}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.push("/(tabs)/dashboard")}
        >
          <Text style={styles.iconButtonText}>Back</Text>
        </Pressable>

        <Pressable
          style={styles.iconButton}
          onPress={() => router.push("/(tabs)/settings")}
        >
          <Text style={styles.iconButtonText}>Settings</Text>
        </Pressable>
      </View>

      <View style={styles.profileHero}>
        <Avatar
          name={displayName}
          email={email}
          imageUrl={
            dbUser?.display_photo_url ||
            dbUser?.profile_photo_url ||
            dbUser?.photo_url
          }
          size={96}
        />

        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>

        <Text style={styles.username} numberOfLines={1}>
          {username}
        </Text>

        <Text style={styles.email} numberOfLines={1}>
          {email}
        </Text>
      </View>

      <AppCard style={styles.metricCard}>
        <ProfileMetric label="Friends" value={friendsSummary.friends.length} />
        <View style={styles.metricDivider} />
        <ProfileMetric label="Rooms" value={rooms.length} />
        <View style={styles.metricDivider} />
        <ProfileMetric label="Wallet" value={formatMoney(walletBalance)} />
      </AppCard>

      <SegmentedTabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as ProfileTab)}
        tabs={[
          { label: "Account", value: "account" },
          { label: "Friends", value: "friends" },
          { label: "Activity", value: "activity" },
        ]}
      />

      {activeTab === "account" && (
        <View style={styles.tabContent}>
          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Profile</Text>
            <Text style={styles.cardTitle}>Account overview</Text>
            <Text style={styles.cardText}>
              Your profile, wallet status, privacy, username, and app settings
              will be managed from here.
            </Text>

            <View style={styles.accountList}>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Display name</Text>
                <Text style={styles.accountValue} numberOfLines={1}>
                  {displayName}
                </Text>
              </View>

              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Email</Text>
                <Text style={styles.accountValue} numberOfLines={1}>
                  {email}
                </Text>
              </View>

              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Username</Text>
                <Text style={styles.accountValue} numberOfLines={1}>
                  {username}
                </Text>
              </View>

              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Wallet balance</Text>
                <AmountText amount={walletBalance} size="sm" tone="primary" />
              </View>
            </View>

            <AppButton
              title="Open app settings"
              onPress={() => router.push("/(tabs)/settings")}
            />
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Coming later</Text>
            <Text style={styles.cardTitle}>Global people search</Text>
            <Text style={styles.cardText}>
              Search by email, name, or username. If the person is not on
              SplitVerse, you will be able to invite them by email or WhatsApp.
            </Text>
          </AppCard>
        </View>
      )}

      {activeTab === "friends" && (
        <View style={styles.tabContent}>
          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Invite by email</Text>
            <Text style={styles.cardTitle}>Send friend request</Text>

            <AppTextInput
              label="Friend email"
              value={friendEmail}
              onChangeText={setFriendEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="friend@example.com"
              editable={!sendingRequest}
            />

            <AppButton
              title="Send request"
              loading={sendingRequest}
              onPress={handleSendRequest}
            />
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Friend inbox</Text>
            <Text style={styles.cardTitle}>Requests to accept</Text>

            {pendingReceivedRequests.length === 0 ? (
              <EmptyState
                title="No pending requests"
                message="Incoming friend requests will appear here."
              />
            ) : (
              <View style={styles.list}>
                {pendingReceivedRequests.map((request) => (
                  <View style={styles.requestRow} key={request.id}>
                    <Avatar
                      name={request.requester_name}
                      email={request.requester_email}
                      size={44}
                    />

                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {request.requester_name || request.requester_email}
                      </Text>
                      <Text style={styles.rowSubtext} numberOfLines={1}>
                        {request.requester_email}
                      </Text>
                    </View>

                    <AppButton
                      title={
                        acceptingRequestId === request.id
                          ? "Accepting"
                          : "Accept"
                      }
                      loading={acceptingRequestId === request.id}
                      onPress={() => handleAcceptRequest(request.id)}
                      style={styles.smallButton}
                    />
                  </View>
                ))}
              </View>
            )}
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Your friends</Text>
            <Text style={styles.cardTitle}>Friend list</Text>

            <AppTextInput
              label="Search friends"
              value={friendSearch}
              onChangeText={setFriendSearch}
              autoCapitalize="none"
              placeholder="Search by name or email"
            />

            {loadingProfileData ? (
              <LoadingState label="Loading friends..." />
            ) : friendsSummary.friends.length === 0 ? (
              <EmptyState
                title="No friends yet"
                message="Send a request or accept one to start splitting together."
              />
            ) : visibleFriends.length === 0 ? (
              <EmptyState
                title="No matching friends"
                message="Try another name or email."
              />
            ) : (
              <View style={styles.list}>
                {visibleFriends.map((friend) => (
                  <View style={styles.friendRow} key={friend.id}>
                    <Avatar
                      name={friend.name}
                      email={friend.email}
                      imageUrl={
                        friend.display_photo_url ||
                        friend.profile_photo_url ||
                        friend.photo_url
                      }
                      size={46}
                    />

                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {getFriendLabel(friend)}
                      </Text>
                      <Text style={styles.rowSubtext} numberOfLines={1}>
                        {friend.email}
                      </Text>
                    </View>

                    <AppButton
                      title={
                        activityLoadingId === friend.id ? "Loading" : "Activity"
                      }
                      loading={activityLoadingId === friend.id}
                      onPress={() => handleOpenActivity(friend.id)}
                      style={styles.activityButton}
                    />
                  </View>
                ))}
              </View>
            )}
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Sent requests</Text>
            <Text style={styles.cardTitle}>Email invites</Text>

            {pendingSentRequests.length === 0 ? (
              <EmptyState
                title="No sent requests"
                message="Requests you send will appear here until accepted."
              />
            ) : (
              <View style={styles.list}>
                {pendingSentRequests.map((request) => (
                  <View style={styles.sentRow} key={request.id}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {request.recipient_email}
                      </Text>
                      <Text style={styles.rowSubtext}>
                        Waiting for acceptance
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </AppCard>
        </View>
      )}

      {activeTab === "activity" && (
        <View style={styles.tabContent}>
          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Rooms</Text>
            <Text style={styles.cardTitle}>Recent split rooms</Text>

            {recentRooms.length === 0 ? (
              <EmptyState
                title="No rooms yet"
                message="Create a split room to start seeing activity."
              />
            ) : (
              <View style={styles.list}>
                {recentRooms.map((room) => (
                  <View style={styles.activityRow} key={room.id}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {room.name}
                      </Text>
                      <Text style={styles.rowSubtext} numberOfLines={1}>
                        {room.category || "Split room"} ·{" "}
                        {room.status || "Active"}
                      </Text>
                    </View>

                    <AmountText
                      amount={Number(room.totalAmount || 0)}
                      size="sm"
                      tone="primary"
                    />
                  </View>
                ))}
              </View>
            )}

            <AppButton
              title="Open rooms"
              variant="secondary"
              onPress={() => router.push("/(tabs)/split-rooms")}
            />
          </AppCard>

          <AppCard style={styles.card}>
            <View style={styles.cardHeadRow}>
              <View>
                <Text style={styles.cardEyebrow}>Transactions</Text>
                <Text style={styles.cardTitle}>Transaction history</Text>
              </View>

              <Text style={styles.countPill}>{transactions.length}</Text>
            </View>

            {transactions.length === 0 ? (
              <EmptyState
                title="No transactions yet"
                message="Wallet payments, top-ups, and settlements will appear here."
              />
            ) : (
              <View style={styles.transactionList}>
                {transactions.map((transaction) => {
                  const item = transaction as ProfileTransaction;
                  const credit = isTransactionCredit(item);

                  return (
                    <View style={styles.transactionRow} key={item.id}>
                      <View style={styles.transactionIcon}>
                        <Text style={styles.transactionIconText}>
                          {credit ? "+" : "-"}
                        </Text>
                      </View>

                      <View style={styles.transactionCopy}>
                        <Text style={styles.transactionTitle} numberOfLines={1}>
                          {getTransactionTitle(item)}
                        </Text>

                        <Text style={styles.transactionMeta} numberOfLines={1}>
                          {(item.status || "completed").toString()} ·{" "}
                          {getTransactionDate(item)}
                        </Text>
                      </View>

                      <AmountText
                        amount={Math.abs(Number(item.amount || 0))}
                        size="sm"
                        tone={credit ? "success" : "danger"}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </AppCard>
        </View>
      )}

      <SheetModal
        visible={Boolean(activity)}
        eyebrow="Friend activity"
        title={
          activity?.friend.name || activity?.friend.email || "Friend activity"
        }
        onClose={() => setActivity(null)}
      >
        <View style={styles.activityStats}>
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
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowSubtext} numberOfLines={1}>
                    {item.source}
                  </Text>
                </View>

                <AmountText amount={item.amount} size="sm" tone="primary" />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No shared activity"
            message="Shared room and settlement activity will appear here."
          />
        )}
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.base,
    backgroundColor: colors.surfaceSoft,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.base,
    paddingTop: spacing.sm,
  },
  iconButton: {
    minHeight: 38,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.base,
  },
  iconButtonText: {
    color: colors.ink,
    ...typography.caption,
  },
  profileHero: {
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  name: {
    marginTop: spacing.sm,
    color: colors.ink,
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  username: {
    color: colors.primary,
    ...typography.bodySm,
  },
  email: {
    color: colors.body,
    ...typography.bodySm,
  },
  metricCard: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
  },
  metricDivider: {
    width: 1,
    height: 38,
    backgroundColor: colors.hairlineSoft,
  },
  tabContent: {
    gap: spacing.base,
  },
  card: {
    gap: spacing.base,
  },
  cardEyebrow: {
    color: colors.body,
    ...typography.caption,
  },
  cardTitle: {
    color: colors.ink,
    ...typography.titleMd,
  },
  cardText: {
    color: colors.body,
    ...typography.bodySm,
  },
  cardHeadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  countPill: {
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.ink,
    ...typography.caption,
  },
  accountList: {
    gap: spacing.sm,
  },
  accountRow: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
    justifyContent: "center",
    gap: 2,
  },
  accountLabel: {
    color: colors.body,
    ...typography.caption,
  },
  accountValue: {
    color: colors.ink,
    ...typography.bodySm,
  },
  list: {
    gap: spacing.sm,
  },
  requestRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  friendRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  sentRow: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
    justifyContent: "center",
  },
  activityRow: {
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
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    color: colors.ink,
    ...typography.titleSm,
  },
  rowSubtext: {
    color: colors.body,
    ...typography.bodySm,
  },
  smallButton: {
    minWidth: 88,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  activityButton: {
    minWidth: 96,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  transactionList: {
    gap: spacing.sm,
  },
  transactionRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  transactionIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.canvas,
  },
  transactionIconText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  transactionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  transactionTitle: {
    color: colors.ink,
    ...typography.titleSm,
  },
  transactionMeta: {
    color: colors.body,
    ...typography.bodySm,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(10, 11, 13, 0.48)",
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
  activityStats: {
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
    lineHeight: 26,
  },
});
