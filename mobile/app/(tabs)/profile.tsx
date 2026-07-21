import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import AmountText from "../../src/components/AmountText";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Avatar from "../../src/components/Avatar";
import DropdownSelect from "../../src/components/DropdownSelect";
import EmptyState from "../../src/components/EmptyState";
import { ProfileSkeleton } from "../../src/components/PageSkeletons";
import ProfileMetric from "../../src/components/ProfileMetric";
import Text from "../../src/components/LocalizedText";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import SheetModal from "../../src/components/SheetModal";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import {
  acceptFriendRequest,
  deleteFriendRequest,
  getFriendActivity,
  getFriendsSummary,
  getSplitRooms,
  getTransactions,
  getWalletSummary,
  searchGlobalPeople,
  sendFriendRequest,
  sendSplitVerseInvite,
  type FriendActivityResponse,
  type FriendsSummary,
  type GlobalPerson,
  type SplitRoom,
  type TransactionItem,
} from "../../src/lib/api";
import {
  getTransactionDisplayAmount,
  normalizeTransactionsForDisplay,
  isCreditLikeTransaction,
} from "../../src/lib/transactionDisplay";
import {
  exportTransactionsFile,
  type TransactionExportFormat,
} from "../../src/lib/transactionExport";
import { showErrorAlert } from "../../src/lib/errors";
import { useRefreshOnReturn } from "../../src/hooks/useRefreshOnReturn";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import { HERO_BLUR_RADIUS } from "../../src/theme/performance";

const emptySummary: FriendsSummary = {
  friends: [],
  receivedRequests: [],
  sentRequests: [],
};
type ProfileTab = "account" | "friends" | "activity";
type ExportMode = "count" | "year";

type ProfileTransaction = TransactionItem & { created_at?: string };

let profileCache: {
  friendsSummary: FriendsSummary;
  rooms: SplitRoom[];
  transactions: TransactionItem[];
  walletBalance: number;
  transactionSummary?: {
    totalTillDate?: number;
    accountCreatedAt?: string;
    count?: number;
  };
} | null = null;


function getRelationshipLabel(status: GlobalPerson["relationshipStatus"]) {
  switch (status) {
    case "friends":
      return "Friends";
    case "request_sent":
      return "Request sent";
    case "request_received":
      return "In your inbox";
    default:
      return "Send request";
  }
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

function isTransactionCredit(transaction: ProfileTransaction) {
  return isCreditLikeTransaction(transaction);
}

function getYearOptions(joinedAt?: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const joined = joinedAt ? new Date(joinedAt) : now;
  const startYear = Number.isNaN(joined.getTime())
    ? currentYear
    : joined.getFullYear();
  const years: { label: string; value: string }[] = [];
  for (let year = currentYear; year >= startYear; year -= 1)
    years.push({ label: String(year), value: String(year) });
  return years.length
    ? years
    : [{ label: String(currentYear), value: String(currentYear) }];
}

export default function Profile() {
  const { user, dbUser } = useAuth();
  const { avatarId, formatCurrency, formatDate, theme } = useAppSettings();
  const { tab, requestId } = useLocalSearchParams<{
    tab?: string | string[];
    requestId?: string | string[];
  }>();

  const [activeTab, setActiveTab] = useState<ProfileTab>("account");
  const [friendsSummary, setFriendsSummary] = useState<FriendsSummary>(
    profileCache?.friendsSummary ?? emptySummary,
  );
  const [rooms, setRooms] = useState<SplitRoom[]>(profileCache?.rooms ?? []);
  const [walletBalance, setWalletBalance] = useState(
    profileCache?.walletBalance ?? Number(dbUser?.wallet_balance || 0),
  );
  const [transactionSummary, setTransactionSummary] = useState(
    profileCache?.transactionSummary ?? {},
  );
  const [friendSearch, setFriendSearch] = useState("");
  const [peopleResults, setPeopleResults] = useState<GlobalPerson[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleSearchCompletedFor, setPeopleSearchCompletedFor] = useState("");
  const [loadingProfileData, setLoadingProfileData] = useState(!profileCache);
  const [sendingTarget, setSendingTarget] = useState("");
  const [acceptingRequestId, setAcceptingRequestId] = useState("");
  const [deletingRequestId, setDeletingRequestId] = useState("");
  const [activityLoadingId, setActivityLoadingId] = useState("");
  const [transactions, setTransactions] = useState<TransactionItem[]>(
    profileCache?.transactions ?? [],
  );
  const [activity, setActivity] = useState<FriendActivityResponse | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("count");
  const [exportFormat, setExportFormat] =
    useState<TransactionExportFormat>("csv");
  const [exportCount, setExportCount] = useState(
    String(
      profileCache?.transactionSummary?.totalTillDate ??
        profileCache?.transactionSummary?.count ??
        10,
    ),
  );
  const [exportYear, setExportYear] = useState(
    String(new Date().getFullYear()),
  );
  const [exporting, setExporting] = useState(false);

  const tabAnimation = useRef(new Animated.Value(1)).current;
  const peopleSearchRequestRef = useRef(0);
  const handledTabParamRef = useRef("");

  useEffect(() => {
    const requestedTab = Array.isArray(tab) ? tab[0] : tab;
    const requestedId = Array.isArray(requestId) ? requestId[0] : requestId;
    const requestSignature = `${requestedTab || ""}:${requestedId || ""}`;

    if (
      requestedTab === "friends" &&
      handledTabParamRef.current !== requestSignature
    ) {
      handledTabParamRef.current = requestSignature;
      setActiveTab("friends");
    }
  }, [requestId, tab]);

  useEffect(() => {
    tabAnimation.setValue(0);
    Animated.spring(tabAnimation, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
      stiffness: 170,
      mass: 0.8,
    }).start();
  }, [activeTab, tabAnimation]);

  useEffect(() => {
    const query = friendSearch.trim();

    if (query.length < 2) {
      peopleSearchRequestRef.current += 1;
      setPeopleResults([]);
      setPeopleSearchCompletedFor("");
      setPeopleLoading(false);
      return;
    }

    const requestId = ++peopleSearchRequestRef.current;
    setPeopleLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await searchGlobalPeople(query);
        if (requestId === peopleSearchRequestRef.current) {
          setPeopleResults(response.people ?? []);
          setPeopleSearchCompletedFor(query.toLowerCase());
        }
      } catch (error) {
        if (requestId === peopleSearchRequestRef.current) {
          setPeopleResults([]);
          setPeopleSearchCompletedFor("");
          showErrorAlert(error, {
            title: "Could not search people",
            fallbackMessage: "Global people search is temporarily unavailable.",
          });
        }
      } finally {
        if (requestId === peopleSearchRequestRef.current) setPeopleLoading(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [friendSearch]);

  const displayName =
    dbUser?.display_name ||
    dbUser?.name ||
    user?.displayName ||
    "SplitVerse user";
  const email = dbUser?.email || user?.email || "";
  const username = dbUser?.username
    ? `@${dbUser.username}`
    : "Username coming soon";
  const photoUrl =
    avatarId === "initials"
      ? undefined
      : dbUser?.display_photo_url ||
        dbUser?.profile_photo_url ||
        dbUser?.photo_url ||
        undefined;

  const pendingReceivedRequests = friendsSummary.receivedRequests.filter(
    (request) => request.status === "pending",
  );
  const pendingSentRequests = friendsSummary.sentRequests.filter(
    (request) => request.status === "pending",
  );
  const recentRooms = rooms.slice(0, 10);
  const recentTransactions = transactions.slice(0, 10);
  const trimmedPeopleSearch = friendSearch.trim();
  const normalizedInviteEmail = trimmedPeopleSearch.toLowerCase();
  const canInviteByEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInviteEmail) &&
    !peopleLoading &&
    peopleSearchCompletedFor === normalizedInviteEmail &&
    peopleResults.length === 0;
  const yearOptions = getYearOptions(transactionSummary.accountCreatedAt);

  const loadProfileData = useCallback(async (silent = false) => {
    try {
      if (!silent && !profileCache) setLoadingProfileData(true);
      const [friendsData, roomsData, transactionData, walletData] =
        await Promise.all([
          getFriendsSummary(),
          getSplitRooms(),
          getTransactions({ limit: 10 }),
          getWalletSummary(),
        ]);
      const nextWalletBalance = Number(
        walletData.summary.availableBalance || 0,
      );
      const displayTransactions = normalizeTransactionsForDisplay(
        transactionData.transactions ?? [],
      );
      profileCache = {
        friendsSummary: friendsData,
        rooms: roomsData.rooms,
        transactions: displayTransactions,
        walletBalance: nextWalletBalance,
        transactionSummary: transactionData.summary,
      };
      setFriendsSummary(friendsData);
      setRooms(roomsData.rooms);
      setTransactions(displayTransactions);
      setWalletBalance(nextWalletBalance);
      setTransactionSummary(transactionData.summary ?? {});
      setExportCount(
        String(
          transactionData.summary?.totalTillDate ??
            transactionData.summary?.count ??
            10,
        ),
      );
    } catch (error) {
      if (!silent) {
        showErrorAlert(error, {
          title: "Could not load profile",
          fallbackMessage:
            "Your profile, friends, rooms, and transaction data could not be loaded. Pull down to try again.",
        });
      }
    } finally {
      setLoadingProfileData(false);
    }
  }, []);

  useEffect(() => {
    void loadProfileData(Boolean(profileCache));
  }, [loadProfileData]);

  useRefreshOnReturn(() => {
    void loadProfileData(true);
  }, [loadProfileData]);

  async function handleSendRequest(
    identifier: string,
    recipientUserId?: string,
  ) {
    try {
      setSendingTarget(recipientUserId || identifier);
      await sendFriendRequest(identifier, recipientUserId);
      await loadProfileData(true);
      const response = await searchGlobalPeople(friendSearch.trim());
      setPeopleResults(response.people ?? []);
      Alert.alert("Request sent", "Friend request created.");
    } catch (error) {
      showErrorAlert(error, {
        title: "Friend request failed",
        fallbackMessage: "The friend request could not be sent. Please try again.",
      });
    } finally {
      setSendingTarget("");
    }
  }

  async function handleSendInvite(emailAddress: string) {
    try {
      setSendingTarget(`invite:${emailAddress}`);
      const response = await sendSplitVerseInvite(emailAddress);
      Alert.alert("Signup invite sent", response.message);
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not send signup invite",
        fallbackMessage: "The signup invitation email could not be sent.",
      });
    } finally {
      setSendingTarget("");
    }
  }

  async function handleDeleteRequest(
    requestId: string,
    mode: "cancel" | "decline",
  ) {
    try {
      setDeletingRequestId(requestId);
      await deleteFriendRequest(requestId);
      await loadProfileData(true);
      Alert.alert(
        mode === "cancel" ? "Request cancelled" : "Request declined",
        mode === "cancel"
          ? "The sent friend request was cancelled."
          : "The friend request was declined.",
      );
    } catch (error) {
      showErrorAlert(error, {
        title: "Could not update request",
        fallbackMessage: "The friend request could not be updated.",
      });
    } finally {
      setDeletingRequestId("");
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
      showErrorAlert(error, {
        title: "Could not accept request",
        fallbackMessage:
          "The friend request could not be accepted. Refresh your requests and try again.",
      });
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
      showErrorAlert(error, {
        title: "Could not load friend activity",
        fallbackMessage:
          "This friend's shared room and settlement activity could not be loaded. Try again.",
      });
    } finally {
      setActivityLoadingId("");
    }
  }

  async function handleExportTransactions() {
    try {
      setExporting(true);
      const count = Math.max(
        1,
        Math.min(
          Number(exportCount || 10),
          Number(
            transactionSummary.totalTillDate || transactionSummary.count || 10,
          ),
        ),
      );
      const response = await getTransactions(
        exportMode === "year"
          ? { exportMode: "year", year: Number(exportYear), limit: 1000 }
          : { exportMode: "count", limit: count },
      );
      const displayTransactions = normalizeTransactionsForDisplay(
        response.transactions ?? [],
      );
      await exportTransactionsFile({
        transactions: displayTransactions,
        format: exportFormat,
        formatCurrency,
        formatDate,
        title:
          exportMode === "year"
            ? `SplitVerse transactions ${exportYear}`
            : `SplitVerse latest ${count} transactions`,
      });
      setExportOpen(false);
    } catch (error) {
      showErrorAlert(error, {
        title: "Transaction export failed",
        fallbackMessage:
          "The transaction file could not be created or shared. Check device storage and try again.",
      });
    } finally {
      setExporting(false);
    }
  }

  if (loadingProfileData && !profileCache) {
    return (
      <Screen scroll={false} safeBackgroundColor={theme.background}>
        <ProfileSkeleton />
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={loadingProfileData}
      onRefresh={() => loadProfileData()}
      safeBackgroundColor={
        theme.mode === "dark" ? theme.background : theme.primary
      }
      contentStyle={[
        styles.screen,
        {
          backgroundColor: theme.background,
          paddingBottom: spacing.xxl + 50,
        },
      ]}
    >
      <View style={styles.heroClip}>
        {photoUrl ? (
          <ImageBackground
            source={{ uri: photoUrl }}
            blurRadius={HERO_BLUR_RADIUS}
            style={styles.heroImage}
            imageStyle={styles.heroImageInner}
          >
            <LinearGradient
              colors={
                theme.mode === "dark"
                  ? ["rgba(0,0,0,0.30)", "rgba(0, 0, 0, 0.86)"]
                  : ["rgba(8, 8, 8, 0.18)", "rgb(255, 255, 255)"]
              }
              style={styles.heroOverlay}
            >
              <ProfileHeroContent
                displayName={displayName}
                email={email}
                username={username}
                photoUrl={photoUrl}
              />
            </LinearGradient>
          </ImageBackground>
        ) : (
          <LinearGradient
            colors={
              theme.mode === "dark"
                ? ["#050608", "#111318"]
                : [theme.primary, theme.primaryActive]
            }
            style={styles.heroOverlay}
          >
            <ProfileHeroContent
              displayName={displayName}
              email={email}
              username={username}
              photoUrl={photoUrl}
            />
          </LinearGradient>
        )}
      </View>

      <AppCard style={styles.metricCard}>
        <Pressable
          style={styles.metricTap}
          onPress={() => router.push("/(tabs)/friends")}
        >
          <ProfileMetric
            label="Friends"
            value={friendsSummary.friends.length}
          />
        </Pressable>
        <View style={styles.metricDivider} />
        <Pressable
          style={styles.metricTap}
          onPress={() => router.push("/(tabs)/room-history")}
        >
          <ProfileMetric label="Rooms" value={rooms.length} />
        </Pressable>
        <View style={styles.metricDivider} />
        <Pressable
          style={styles.metricTap}
          onPress={() => router.push("/(tabs)/wallet")}
        >
          <ProfileMetric label="Wallet" value={formatCurrency(walletBalance)} />
        </Pressable>
      </AppCard>

      <View style={styles.tabsWrap}>
        <SegmentedTabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as ProfileTab)}
          tabs={[
            { label: "Account", value: "account" },
            { label: "Friends", value: "friends" },
            { label: "Activity", value: "activity" },
          ]}
        />
      </View>

      <Animated.View
        style={{
          opacity: tabAnimation,
          transform: [
            {
              translateX: tabAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        }}
      >
        {activeTab === "account" && (
          <View style={styles.tabContent}>
            <AppCard style={styles.card}>
              <Text style={styles.cardEyebrow}>Profile</Text>
              <Text style={styles.cardTitle}>Account overview</Text>
              <View style={styles.accountList}>
                <InfoRow label="Display name" value={displayName} />
                <InfoRow label="Email" value={email} />
                <InfoRow label="Username" value={username} />
                <View
                  style={[
                    styles.accountRow,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <Text style={styles.accountLabel}>Wallet balance</Text>
                  <AmountText amount={walletBalance} size="sm" tone="primary" />
                </View>
              </View>
              <AppButton
                title="Open settings"
                onPress={() => router.push("/(tabs)/settings")}
              />
            </AppCard>
          </View>
        )}

        {activeTab === "friends" && (
          <View style={styles.tabContent}>
            <AppCard style={styles.card}>
              <Text style={styles.cardEyebrow}>Global people search</Text>
              <Text style={styles.cardTitle}>Find and invite</Text>
              <AppTextInput
                label="Username, name, or exact email"
                value={friendSearch}
                onChangeText={setFriendSearch}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="@username or person@example.com"
              />

              {peopleLoading ? (
                <Text style={styles.cardText}>Searching SplitVerse…</Text>
              ) : trimmedPeopleSearch.length < 2 ? (
                <Text style={styles.cardText}>Enter at least 2 characters.</Text>
              ) : peopleResults.length === 0 ? (
                <View style={styles.searchEmpty}>
                  <Text style={styles.cardText}>No matching people found.</Text>
                  {canInviteByEmail ? (
                    <AppButton
                      title={
                        sendingTarget === `invite:${normalizedInviteEmail}`
                          ? "Sending invite"
                          : "Send signup invite"
                      }
                      loading={sendingTarget === `invite:${normalizedInviteEmail}`}
                      onPress={() => void handleSendInvite(normalizedInviteEmail)}
                    />
                  ) : null}
                </View>
              ) : (
                <ScrollView
                  style={peopleResults.length > 3 ? styles.peopleResultsViewport : undefined}
                  contentContainerStyle={styles.list}
                  scrollEnabled={peopleResults.length > 3}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {peopleResults.map((person) => {
                    const canSend = person.relationshipStatus === "none";
                    const sending = sendingTarget === person.id;
                    return (
                      <View
                        key={person.id}
                        style={[
                          styles.personRow,
                          { borderColor: theme.border, backgroundColor: theme.surface },
                        ]}
                      >
                        <Avatar
                          name={person.name}
                          email={person.emailHint}
                          imageUrl={
                            person.display_photo_url ||
                            person.profile_photo_url ||
                            person.photo_url
                          }
                          size={42}
                        />
                        <View style={styles.rowCopy}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {person.name || `@${person.username}`}
                          </Text>
                          <Text style={styles.rowSubtext} numberOfLines={1}>
                            @{person.username}
                            {person.emailHint ? ` · ${person.emailHint}` : ""}
                          </Text>
                        </View>
                        <AppButton
                          title={sending ? "Sending" : getRelationshipLabel(person.relationshipStatus)}
                          loading={sending}
                          disabled={!canSend || Boolean(sendingTarget)}
                          variant={canSend ? "primary" : "secondary"}
                          style={styles.personAction}
                          onPress={() =>
                            void handleSendRequest(person.username, person.id)
                          }
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </AppCard>

            <AppCard style={styles.card}>
              <Text style={styles.cardEyebrow}>Friend inbox</Text>
              <Text style={styles.cardTitle}>Requests to accept</Text>
              {pendingReceivedRequests.length === 0 ? (
                <EmptyState title="No pending requests" />
              ) : (
                <View style={styles.list}>
                  {pendingReceivedRequests.map((request) => (
                    <View
                      style={[
                        styles.requestRow,
                        { borderColor: theme.border, backgroundColor: theme.surface },
                      ]}
                      key={request.id}
                    >
                      <Avatar
                        name={request.requester_name}
                        email={request.requester_email}
                        size={42}
                      />
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {request.requester_name || request.requester_email}
                        </Text>
                        <Text style={styles.rowSubtext} numberOfLines={1}>
                          {request.requester_username
                            ? `@${request.requester_username}`
                            : request.requester_email}
                        </Text>
                      </View>
                      <View style={styles.requestActions}>
                        <AppButton
                          title={acceptingRequestId === request.id ? "Accepting" : "Accept"}
                          loading={acceptingRequestId === request.id}
                          disabled={deletingRequestId === request.id}
                          onPress={() => handleAcceptRequest(request.id)}
                          style={styles.compactAction}
                        />
                        <AppButton
                          title={deletingRequestId === request.id ? "Declining" : "Decline"}
                          loading={deletingRequestId === request.id}
                          disabled={acceptingRequestId === request.id}
                          variant="secondary"
                          onPress={() => void handleDeleteRequest(request.id, "decline")}
                          style={styles.compactAction}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </AppCard>

            <AppCard style={styles.card}>
              <Text style={styles.cardEyebrow}>Sent requests</Text>
              <Text style={styles.cardTitle}>Waiting for acceptance</Text>
              {pendingSentRequests.length === 0 ? (
                <EmptyState title="No sent requests" />
              ) : (
                <View style={styles.list}>
                  {pendingSentRequests.map((request) => (
                    <View
                      style={[
                        styles.sentRow,
                        { borderColor: theme.border, backgroundColor: theme.surface },
                      ]}
                      key={request.id}
                    >
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {request.recipient_email}
                        </Text>
                        <Text style={styles.rowSubtext}>Waiting for acceptance</Text>
                      </View>
                      <AppButton
                        title={deletingRequestId === request.id ? "Cancelling" : "Cancel"}
                        loading={deletingRequestId === request.id}
                        variant="secondary"
                        style={styles.compactAction}
                        onPress={() => void handleDeleteRequest(request.id, "cancel")}
                      />
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
              <Text style={styles.cardTitle}>Recent split rooms</Text>
              {recentRooms.length === 0 ? (
                <EmptyState title="No rooms yet" />
              ) : (
                <ScrollView
                  style={recentRooms.length > 3 ? styles.roomActivityScroll : undefined}
                  contentContainerStyle={styles.list}
                  scrollEnabled={recentRooms.length > 3}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {recentRooms.map((room) => (
                    <View
                      style={[
                        styles.activityRow,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.surface,
                        },
                      ]}
                      key={room.id}
                    >
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{room.name}</Text>
                        <Text style={styles.rowSubtext}>
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
                </ScrollView>
              )}
              <AppButton
                title="Open rooms"
                variant="secondary"
                onPress={() => router.push("/(tabs)/room-history")}
              />
            </AppCard>

            <AppCard style={styles.card}>
              <View style={styles.cardHeadRow}>
                <View>
                  <Text style={styles.cardTitle}>Transaction history</Text>
                </View>
              </View>
              <Text style={styles.cardText}>
                Showing only the latest 10 transactions.
              </Text>
              {recentTransactions.length === 0 ? (
                <EmptyState title="No transactions yet" />
              ) : (
                <ScrollView
                  style={
                    recentTransactions.length > 4
                      ? styles.transactionScroll
                      : undefined
                  }
                  nestedScrollEnabled
                  scrollEnabled={recentTransactions.length > 4}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.transactionList}>
                    {recentTransactions.map((transaction) => {
                      const item = transaction as ProfileTransaction;
                      const credit = isTransactionCredit(item);
                      return (
                        <View
                          style={[
                            styles.transactionRow,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.surface,
                            },
                          ]}
                          key={item.id}
                        >
                          <View
                            style={[
                              styles.transactionIcon,
                              {
                                backgroundColor: credit
                                  ? theme.primarySoft
                                  : theme.surfaceStrong,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.transactionIconText,
                                {
                                  color: credit ? theme.success : theme.danger,
                                },
                              ]}
                            >
                              {credit ? "+" : "-"}
                            </Text>
                          </View>
                          <View style={styles.transactionCopy}>
                            <Text
                              style={styles.transactionTitle}
                              numberOfLines={1}
                            >
                              {getTransactionTitle(item)}
                            </Text>
                            <Text
                              style={styles.transactionMeta}
                              numberOfLines={1}
                            >
                              {(item.status || "completed").toString()} ·{" "}
                              {formatDate(
                                item.createdAt ||
                                  item.created_at ||
                                  item.displayDate,
                              )}
                            </Text>
                          </View>
                          <AmountText
                            amount={Math.abs(getTransactionDisplayAmount(item))}
                            size="sm"
                            tone={credit ? "success" : "danger"}
                          />
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
              <AppButton
                title="Export transactions"
                onPress={() => setExportOpen(true)}
              />
            </AppCard>
          </View>
        )}
      </Animated.View>

      <SheetModal
        visible={Boolean(activity)}
        eyebrow="Friend activity"
        title={
          activity?.friend.name || activity?.friend.email || "Friend activity"
        }
        onClose={() => setActivity(null)}
      >
        <View style={styles.activityStats}>
          <InfoStat
            label="Rooms"
            value={String(activity?.summary.roomsTogether ?? 0)}
          />
          <InfoStat
            label="Settled"
            value={formatCurrency(activity?.summary.totalSettled ?? 0)}
          />
          <InfoStat
            label="Net"
            value={formatCurrency(activity?.summary.netPosition ?? 0)}
          />
        </View>
        {activity?.recentActivity.length ? (
          <View style={styles.list}>
            {activity.recentActivity.slice(0, 5).map((item) => (
              <View
                style={[
                  styles.activityRow,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                ]}
                key={item.id}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowSubtext}>{item.source}</Text>
                </View>
                <AmountText amount={item.amount} size="sm" tone="primary" />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No shared activity" />
        )}
      </SheetModal>

      <SheetModal
        visible={exportOpen}
        eyebrow="Transactions"
        title="Export transaction history"
        onClose={() => setExportOpen(false)}
      >
        <DropdownSelect
          label="File format"
          value={exportFormat}
          options={[
            { label: "CSV file", value: "csv" },
            { label: "PDF file", value: "pdf" },
          ]}
          onChange={(value) =>
            setExportFormat(value as TransactionExportFormat)
          }
        />
        <DropdownSelect
          label="Export type"
          value={exportMode}
          options={[
            { label: "Number of transactions", value: "count" },
            { label: "Previous year / joined year", value: "year" },
          ]}
          onChange={(value) => setExportMode(value as ExportMode)}
        />
        {exportMode === "count" ? (
          <AppTextInput
            label="Number of transactions"
            value={exportCount}
            onChangeText={(value) => setExportCount(value.replace(/\D/g, ""))}
            keyboardType="number-pad"
            placeholder={String(
              transactionSummary.totalTillDate ??
                transactionSummary.count ??
                10,
            )}
          />
        ) : (
          <DropdownSelect
            label="Year"
            value={exportYear}
            options={yearOptions}
            onChange={setExportYear}
          />
        )}
        <AppButton
          title={exporting ? "Preparing export" : "Export"}
          loading={exporting}
          onPress={handleExportTransactions}
        />
      </SheetModal>
    </Screen>
  );
}

function ProfileHeroContent({
  displayName,
  email,
  username,
  photoUrl,
}: {
  displayName: string;
  email: string;
  username: string;
  photoUrl?: string;
}) {
  return (
    <View style={styles.heroContent}>
      <View style={styles.heroTop}>
        <Pressable
          accessibilityLabel="Back"
          style={styles.iconButton}
          onPress={() => router.push("/(tabs)/dashboard")}
        >
          <Ionicons name="chevron-back" size={20} color="#ffffff" />
        </Pressable>
        <Pressable
          accessibilityLabel="Settings"
          style={styles.iconButton}
          onPress={() => router.push("/(tabs)/settings")}
        >
          <Ionicons name="settings-outline" size={20} color="#ffffff" />
        </Pressable>
      </View>
      <Avatar name={displayName} email={email} imageUrl={photoUrl} size={94} />
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
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppSettings();
  return (
    <View
      style={[
        styles.accountRow,
        { borderColor: theme.border, backgroundColor: theme.surface },
      ]}
    >
      <Text style={styles.accountLabel}>{label}</Text>
      <Text style={styles.accountValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  const { theme } = useAppSettings();
  return (
    <View
      style={[
        styles.activityStat,
        { borderColor: theme.border, backgroundColor: theme.surface },
      ]}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.base,
    padding: 0,
    paddingBottom: spacing.xxl + 160,
    backgroundColor: colors.surfaceSoft,
  },
  heroClip: {
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroImage: { minHeight: 336 },
  heroImageInner: { opacity: 0.95 },
  heroOverlay: {
    minHeight: 336,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  heroContent: { alignItems: "center", gap: spacing.xs },
  heroTop: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.base,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  iconButtonText: { color: colors.onPrimary, ...typography.caption },
  name: {
    marginTop: spacing.sm,
    color: colors.onPrimary,
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  username: { color: "rgba(255,255,255,0.84)", ...typography.bodySm },
  email: { color: "rgba(255,255,255,0.78)", ...typography.bodySm },
  metricCard: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  metricTap: { flex: 1, minWidth: 0 },
  metricDivider: { width: 1, height: 38, backgroundColor: colors.hairlineSoft },
  tabsWrap: { marginHorizontal: spacing.base },
  tabContent: { gap: spacing.base, paddingHorizontal: spacing.base },
  card: { gap: spacing.base },
  cardEyebrow: { color: colors.body, ...typography.caption },
  cardTitle: { color: colors.ink, ...typography.titleMd },
  cardText: { color: colors.body, ...typography.bodySm },
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
  accountList: { gap: spacing.sm },
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
  accountLabel: { color: colors.body, ...typography.caption },
  accountValue: { color: colors.ink, ...typography.bodySm },
  list: { gap: spacing.sm },
  peopleResultsViewport: { maxHeight: 3 * 70 + 2 * spacing.sm, flexGrow: 0 },
  personRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  personAction: { minWidth: 100, maxWidth: 126, minHeight: 40, paddingHorizontal: spacing.sm },
  requestActions: { gap: spacing.xs, alignItems: "stretch" },
  compactAction: { minWidth: 86, maxWidth: 108, minHeight: 38, paddingHorizontal: spacing.xs },
  searchEmpty: { gap: spacing.sm },
  roomActivityScroll: { maxHeight: 3 * 64 + 2 * spacing.sm, flexGrow: 0 },
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
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: colors.ink, ...typography.titleSm },
  rowSubtext: { color: colors.body, ...typography.bodySm },
  smallButton: { minWidth: 88, minHeight: 40, paddingHorizontal: spacing.sm },
  activityButton: {
    minWidth: 96,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  transactionScroll: {
    maxHeight: 4 * 68 + 3 * spacing.sm,
    flexGrow: 0,
  },
  transactionList: { gap: spacing.sm },
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
  transactionIconText: { fontSize: 20, fontWeight: "800" },
  transactionCopy: { flex: 1, minWidth: 0, gap: 2 },
  transactionTitle: { color: colors.ink, ...typography.titleSm },
  transactionMeta: { color: colors.body, ...typography.bodySm },
  activityStats: { gap: spacing.sm },
  activityStat: {
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  statLabel: { color: colors.body, ...typography.caption },
  statValue: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 26,
  },
});
