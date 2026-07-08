import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, View } from "react-native";
import AmountText from "../../src/components/AmountText";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Avatar from "../../src/components/Avatar";
import DropdownSelect from "../../src/components/DropdownSelect";
import EmptyState from "../../src/components/EmptyState";
import LoadingState from "../../src/components/LoadingState";
import ProfileMetric from "../../src/components/ProfileMetric";
import Text from "../../src/components/LocalizedText";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import SheetModal from "../../src/components/SheetModal";
import { useAuth } from "../../src/context/AuthContext";
import { useAppSettings } from "../../src/context/useAppSettings";
import {
  acceptFriendRequest,
  getFriendActivity,
  getFriendsSummary,
  getSplitRooms,
  getTransactions,
  getWalletSummary,
  sendFriendRequest,
  type Friend,
  type FriendActivityResponse,
  type FriendsSummary,
  type SplitRoom,
  type TransactionItem,
} from "../../src/lib/api";
import { getTransactionDisplayAmount, normalizeTransactionsForDisplay, isCreditLikeTransaction } from "../../src/lib/transactionDisplay";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

const emptySummary: FriendsSummary = { friends: [], receivedRequests: [], sentRequests: [] };
type ProfileTab = "account" | "friends" | "activity";
type ExportMode = "count" | "year";

type ProfileTransaction = TransactionItem & { created_at?: string };

let profileCache: {
  friendsSummary: FriendsSummary;
  rooms: SplitRoom[];
  transactions: TransactionItem[];
  walletBalance: number;
  transactionSummary?: { totalTillDate?: number; accountCreatedAt?: string; count?: number };
} | null = null;

function getFriendLabel(friend: Friend) {
  return friend.name || friend.email.split("@")[0] || friend.email;
}

function getTransactionTitle(transaction: ProfileTransaction) {
  return transaction.description || transaction.roomName || transaction.counterpartyName || transaction.counterpartyEmail || transaction.type || "Transaction";
}

function isTransactionCredit(transaction: ProfileTransaction) {
  return isCreditLikeTransaction(transaction);
}

function getYearOptions(joinedAt?: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const joined = joinedAt ? new Date(joinedAt) : now;
  const startYear = Number.isNaN(joined.getTime()) ? currentYear : joined.getFullYear();
  const years: { label: string; value: string }[] = [];
  for (let year = currentYear; year >= startYear; year -= 1) years.push({ label: String(year), value: String(year) });
  return years.length ? years : [{ label: String(currentYear), value: String(currentYear) }];
}

export default function Profile() {
  const { user, dbUser } = useAuth();
  const { avatarId, formatCurrency, formatDate, theme } = useAppSettings();

  const [activeTab, setActiveTab] = useState<ProfileTab>("account");
  const [friendsSummary, setFriendsSummary] = useState<FriendsSummary>(profileCache?.friendsSummary ?? emptySummary);
  const [rooms, setRooms] = useState<SplitRoom[]>(profileCache?.rooms ?? []);
  const [walletBalance, setWalletBalance] = useState(profileCache?.walletBalance ?? Number(dbUser?.wallet_balance || 0));
  const [transactionSummary, setTransactionSummary] = useState(profileCache?.transactionSummary ?? {});
  const [friendEmail, setFriendEmail] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const [loadingProfileData, setLoadingProfileData] = useState(!profileCache);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState("");
  const [activityLoadingId, setActivityLoadingId] = useState("");
  const [transactions, setTransactions] = useState<TransactionItem[]>(profileCache?.transactions ?? []);
  const [activity, setActivity] = useState<FriendActivityResponse | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("count");
  const [exportCount, setExportCount] = useState(String(profileCache?.transactionSummary?.totalTillDate ?? profileCache?.transactionSummary?.count ?? 10));
  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()));
  const [exporting, setExporting] = useState(false);

  const displayName = dbUser?.display_name || dbUser?.name || user?.displayName || "SplitVerse user";
  const email = dbUser?.email || user?.email || "";
  const username = dbUser?.username ? `@${dbUser.username}` : "Username coming soon";
  const photoUrl = avatarId === "initials" ? undefined : dbUser?.display_photo_url || dbUser?.profile_photo_url || dbUser?.photo_url || undefined;

  const pendingReceivedRequests = friendsSummary.receivedRequests.filter((request) => request.status === "pending");
  const pendingSentRequests = friendsSummary.sentRequests.filter((request) => request.status === "pending");
  const visibleFriends = useMemo(() => {
    const search = friendSearch.trim().toLowerCase();
    if (!search) return friendsSummary.friends;
    return friendsSummary.friends.filter((friend) => `${friend.name ?? ""} ${friend.email}`.toLowerCase().includes(search));
  }, [friendSearch, friendsSummary.friends]);
  const recentRooms = rooms.slice(0, 4);
  const recentTransactions = transactions.slice(0, 10);
  const yearOptions = getYearOptions(transactionSummary.accountCreatedAt);

  const loadProfileData = useCallback(async (silent = false) => {
    try {
      if (!silent && !profileCache) setLoadingProfileData(true);
      const [friendsData, roomsData, transactionData, walletData] = await Promise.all([
        getFriendsSummary(),
        getSplitRooms(),
        getTransactions({ limit: 10 }),
        getWalletSummary(),
      ]);
      const nextWalletBalance = Number(walletData.summary.availableBalance || 0);
      const displayTransactions = normalizeTransactionsForDisplay(transactionData.transactions ?? []);
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
      setExportCount(String(transactionData.summary?.totalTillDate ?? transactionData.summary?.count ?? 10));
    } catch (error) {
      if (!silent) Alert.alert("Profile failed", error instanceof Error ? error.message : "Could not load profile");
    } finally {
      setLoadingProfileData(false);
    }
  }, []);

  useEffect(() => {
    void loadProfileData(Boolean(profileCache));
  }, [loadProfileData]);

  useFocusEffect(
    useCallback(() => {
      void loadProfileData(true);
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
      Alert.alert("Request failed", error instanceof Error ? error.message : "Could not send request");
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
      Alert.alert("Accept failed", error instanceof Error ? error.message : "Could not accept request");
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
      Alert.alert("Activity failed", error instanceof Error ? error.message : "Could not load activity");
    } finally {
      setActivityLoadingId("");
    }
  }

  async function handleExportTransactions() {
    try {
      setExporting(true);
      const count = Math.max(1, Math.min(Number(exportCount || 10), Number(transactionSummary.totalTillDate || transactionSummary.count || 10)));
      const response = await getTransactions(
        exportMode === "year"
          ? { exportMode: "year", year: Number(exportYear), limit: 1000 }
          : { exportMode: "count", limit: count },
      );
      Alert.alert("Export ready", `${response.transactions.length} transaction records are ready. File sharing will be connected next.`);
      setExportOpen(false);
    } catch (error) {
      Alert.alert("Export failed", error instanceof Error ? error.message : "Could not export transactions.");
    } finally {
      setExporting(false);
    }
  }

  if (loadingProfileData && !profileCache) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loadingProfileData} onRefresh={() => loadProfileData()} safeBackgroundColor={theme.primary} contentStyle={[styles.screen, { backgroundColor: theme.background }]}> 
      <View style={styles.heroClip}>
        {photoUrl ? (
          <ImageBackground source={{ uri: photoUrl }} blurRadius={28} style={styles.heroImage} imageStyle={styles.heroImageInner}>
            <LinearGradient
              colors={
                theme.mode === "dark"
                  ? ["rgba(0,0,0,0.30)", "rgba(0,0,0,0.72)"]
                  : ["rgba(0,0,0,0.08)", "rgba(0,82,255,0.42)"]
              }
              style={styles.heroOverlay}
            >
              <ProfileHeroContent displayName={displayName} email={email} username={username} photoUrl={photoUrl} />
            </LinearGradient>
          </ImageBackground>
        ) : (
          <LinearGradient colors={[theme.primary, theme.primaryActive]} style={styles.heroOverlay}>
            <ProfileHeroContent displayName={displayName} email={email} username={username} photoUrl={photoUrl} />
          </LinearGradient>
        )}
      </View>

      <AppCard style={styles.metricCard}>
        <ProfileMetric label="Friends" value={friendsSummary.friends.length} />
        <View style={styles.metricDivider} />
        <ProfileMetric label="Rooms" value={rooms.length} />
        <View style={styles.metricDivider} />
        <ProfileMetric label="Wallet" value={formatCurrency(walletBalance)} />
      </AppCard>

      <View style={styles.tabsWrap}>
        <SegmentedTabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as ProfileTab)}
          tabs={[{ label: "Account", value: "account" }, { label: "Friends", value: "friends" }, { label: "Activity", value: "activity" }]}
        />
      </View>

      {activeTab === "account" && (
        <View style={styles.tabContent}>
          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Profile</Text>
            <Text style={styles.cardTitle}>Account overview</Text>
            <View style={styles.accountList}>
              <InfoRow label="Display name" value={displayName} />
              <InfoRow label="Email" value={email} />
              <InfoRow label="Username" value={username} />
              <View style={[styles.accountRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Text style={styles.accountLabel}>Wallet balance</Text>
                <AmountText amount={walletBalance} size="sm" tone="primary" />
              </View>
            </View>
            <AppButton title="Open app settings" onPress={() => router.push("/(tabs)/settings")} />
          </AppCard>
        </View>
      )}

      {activeTab === "friends" && (
        <View style={styles.tabContent}>
          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Invite by email</Text>
            <Text style={styles.cardTitle}>Send friend request</Text>
            <AppTextInput label="Friend email" value={friendEmail} onChangeText={setFriendEmail} autoCapitalize="none" keyboardType="email-address" placeholder="friend@example.com" editable={!sendingRequest} />
            <AppButton title="Send request" loading={sendingRequest} onPress={handleSendRequest} />
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Friend inbox</Text>
            <Text style={styles.cardTitle}>Requests to accept</Text>
            {pendingReceivedRequests.length === 0 ? <EmptyState title="No pending requests" /> : (
              <View style={styles.list}>
                {pendingReceivedRequests.map((request) => (
                  <View style={[styles.requestRow, { borderColor: theme.border, backgroundColor: theme.surface }]} key={request.id}>
                    <Avatar name={request.requester_name} email={request.requester_email} size={44} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{request.requester_name || request.requester_email}</Text>
                      <Text style={styles.rowSubtext} numberOfLines={1}>{request.requester_email}</Text>
                    </View>
                    <AppButton title={acceptingRequestId === request.id ? "Accepting" : "Accept"} loading={acceptingRequestId === request.id} onPress={() => handleAcceptRequest(request.id)} style={styles.smallButton} />
                  </View>
                ))}
              </View>
            )}
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Your friends</Text>
            <Text style={styles.cardTitle}>Friend list</Text>
            <AppTextInput label="Search friends" value={friendSearch} onChangeText={setFriendSearch} autoCapitalize="none" placeholder="Search by name or email" />
            {friendsSummary.friends.length === 0 ? <EmptyState title="No friends yet" /> : visibleFriends.length === 0 ? <EmptyState title="No matching friends" /> : (
              <View style={styles.list}>
                {visibleFriends.map((friend) => (
                  <View style={[styles.friendRow, { borderColor: theme.border, backgroundColor: theme.surface }]} key={friend.id}>
                    <Avatar name={friend.name} email={friend.email} imageUrl={friend.display_photo_url || friend.profile_photo_url || friend.photo_url} size={46} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{getFriendLabel(friend)}</Text>
                      <Text style={styles.rowSubtext} numberOfLines={1}>{friend.email}</Text>
                    </View>
                    <AppButton title={activityLoadingId === friend.id ? "Loading" : "Activity"} loading={activityLoadingId === friend.id} onPress={() => handleOpenActivity(friend.id)} style={styles.activityButton} />
                  </View>
                ))}
              </View>
            )}
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Sent requests</Text>
            <Text style={styles.cardTitle}>Email invites</Text>
            {pendingSentRequests.length === 0 ? <EmptyState title="No sent requests" /> : (
              <View style={styles.list}>{pendingSentRequests.map((request) => <View style={[styles.sentRow, { borderColor: theme.border, backgroundColor: theme.surface }]} key={request.id}><Text style={styles.rowTitle}>{request.recipient_email}</Text><Text style={styles.rowSubtext}>Waiting for acceptance</Text></View>)}</View>
            )}
          </AppCard>
        </View>
      )}

      {activeTab === "activity" && (
        <View style={styles.tabContent}>
          <AppCard style={styles.card}>
            <Text style={styles.cardEyebrow}>Rooms</Text>
            <Text style={styles.cardTitle}>Recent split rooms</Text>
            {recentRooms.length === 0 ? <EmptyState title="No rooms yet" /> : (
              <View style={styles.list}>{recentRooms.map((room) => <View style={[styles.activityRow, { borderColor: theme.border, backgroundColor: theme.surface }]} key={room.id}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{room.name}</Text><Text style={styles.rowSubtext}>{room.category || "Split room"} · {room.status || "Active"}</Text></View><AmountText amount={Number(room.totalAmount || 0)} size="sm" tone="primary" /></View>)}</View>
            )}
            <AppButton title="Open rooms" variant="secondary" onPress={() => router.push("/(tabs)/split-rooms")} />
          </AppCard>

          <AppCard style={styles.card}>
            <View style={styles.cardHeadRow}>
              <View>
                <Text style={styles.cardEyebrow}>Transactions</Text>
                <Text style={styles.cardTitle}>Transaction history</Text>
              </View>
              <Text style={styles.countPill}>{recentTransactions.length}/10</Text>
            </View>
            <Text style={styles.cardText}>Showing only the latest 10 transactions. The list scrolls after 5 recent transactions.</Text>
            {recentTransactions.length === 0 ? <EmptyState title="No transactions yet" /> : (
              <ScrollView style={recentTransactions.length > 5 ? styles.transactionScroll : undefined} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                <View style={styles.transactionList}>{recentTransactions.map((transaction) => {
                  const item = transaction as ProfileTransaction;
                  const credit = isTransactionCredit(item);
                  return (
                    <View style={[styles.transactionRow, { borderColor: theme.border, backgroundColor: theme.surface }]} key={item.id}>
                      <View style={[styles.transactionIcon, { backgroundColor: credit ? theme.primarySoft : theme.surfaceStrong }]}><Text style={[styles.transactionIconText, { color: credit ? theme.success : theme.danger }]}>{credit ? "+" : "-"}</Text></View>
                      <View style={styles.transactionCopy}>
                        <Text style={styles.transactionTitle} numberOfLines={1}>{getTransactionTitle(item)}</Text>
                        <Text style={styles.transactionMeta} numberOfLines={1}>{(item.status || "completed").toString()} · {formatDate(item.createdAt || item.created_at || item.displayDate)}</Text>
                      </View>
                      <AmountText amount={Math.abs(getTransactionDisplayAmount(item))} size="sm" tone={credit ? "success" : "danger"} />
                    </View>
                  );
                })}</View>
              </ScrollView>
            )}
            <AppButton title="Export transactions" onPress={() => setExportOpen(true)} />
          </AppCard>
        </View>
      )}

      <SheetModal visible={Boolean(activity)} eyebrow="Friend activity" title={activity?.friend.name || activity?.friend.email || "Friend activity"} onClose={() => setActivity(null)}>
        <View style={styles.activityStats}>
          <InfoStat label="Rooms" value={String(activity?.summary.roomsTogether ?? 0)} />
          <InfoStat label="Settled" value={formatCurrency(activity?.summary.totalSettled ?? 0)} />
          <InfoStat label="Net" value={formatCurrency(activity?.summary.netPosition ?? 0)} />
        </View>
        {activity?.recentActivity.length ? <View style={styles.list}>{activity.recentActivity.slice(0, 5).map((item) => <View style={[styles.activityRow, { borderColor: theme.border, backgroundColor: theme.surface }]} key={item.id}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowSubtext}>{item.source}</Text></View><AmountText amount={item.amount} size="sm" tone="primary" /></View>)}</View> : <EmptyState title="No shared activity" />}
      </SheetModal>

      <SheetModal visible={exportOpen} eyebrow="Transactions" title="Export transaction history" onClose={() => setExportOpen(false)}>
        <DropdownSelect label="Export type" value={exportMode} options={[{ label: "Number of transactions", value: "count" }, { label: "Previous year / joined year", value: "year" }]} onChange={(value) => setExportMode(value as ExportMode)} />
        {exportMode === "count" ? <AppTextInput label="Number of transactions" value={exportCount} onChangeText={(value) => setExportCount(value.replace(/\D/g, ""))} keyboardType="number-pad" placeholder={String(transactionSummary.totalTillDate ?? transactionSummary.count ?? 10)} /> : <DropdownSelect label="Year" value={exportYear} options={yearOptions} onChange={setExportYear} />}
        <AppButton title={exporting ? "Preparing export" : "Export"} loading={exporting} onPress={handleExportTransactions} />
      </SheetModal>
    </Screen>
  );
}

function ProfileHeroContent({ displayName, email, username, photoUrl }: { displayName: string; email: string; username: string; photoUrl?: string }) {
  return (
    <View style={styles.heroContent}>
      <View style={styles.heroTop}>
        <Pressable style={styles.iconButton} onPress={() => router.push("/(tabs)/dashboard")}><Text style={styles.iconButtonText}>Back</Text></Pressable>
        <Pressable style={styles.iconButton} onPress={() => router.push("/(tabs)/settings")}><Text style={styles.iconButtonText}>Settings</Text></Pressable>
      </View>
      <Avatar name={displayName} email={email} imageUrl={photoUrl} size={94} />
      <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
      <Text style={styles.username} numberOfLines={1}>{username}</Text>
      <Text style={styles.email} numberOfLines={1}>{email}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppSettings();
  return <View style={[styles.accountRow, { borderColor: theme.border, backgroundColor: theme.surface }]}><Text style={styles.accountLabel}>{label}</Text><Text style={styles.accountValue} numberOfLines={1}>{value}</Text></View>;
}

function InfoStat({ label, value }: { label: string; value: string }) {
  const { theme } = useAppSettings();
  return <View style={[styles.activityStat, { borderColor: theme.border, backgroundColor: theme.surface }]}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.base, padding: 0, paddingBottom: spacing.xxl, backgroundColor: colors.surfaceSoft },
  heroClip: { overflow: "hidden", borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroImage: { minHeight: 336 },
  heroImageInner: { opacity: 0.95 },
  heroOverlay: { minHeight: 336, paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  heroContent: { alignItems: "center", gap: spacing.xs },
  heroTop: { width: "100%", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.base },
  iconButton: { minHeight: 38, justifyContent: "center", borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: spacing.base },
  iconButtonText: { color: colors.onPrimary, ...typography.caption },
  name: { marginTop: spacing.sm, color: colors.onPrimary, fontSize: 24, fontWeight: "600", lineHeight: 30 },
  username: { color: "rgba(255,255,255,0.84)", ...typography.bodySm },
  email: { color: "rgba(255,255,255,0.78)", ...typography.bodySm },
  metricCard: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.base, marginTop: -spacing.xl, paddingHorizontal: spacing.sm },
  metricDivider: { width: 1, height: 38, backgroundColor: colors.hairlineSoft },
  tabsWrap: { marginHorizontal: spacing.base },
  tabContent: { gap: spacing.base, paddingHorizontal: spacing.base },
  card: { gap: spacing.base },
  cardEyebrow: { color: colors.body, ...typography.caption },
  cardTitle: { color: colors.ink, ...typography.titleMd },
  cardText: { color: colors.body, ...typography.bodySm },
  cardHeadRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.base },
  countPill: { overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.surfaceStrong, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, color: colors.ink, ...typography.caption },
  accountList: { gap: spacing.sm },
  accountRow: { minHeight: 54, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft, padding: spacing.sm, justifyContent: "center", gap: 2 },
  accountLabel: { color: colors.body, ...typography.caption },
  accountValue: { color: colors.ink, ...typography.bodySm },
  list: { gap: spacing.sm },
  requestRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft, padding: spacing.sm },
  friendRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft, padding: spacing.sm },
  sentRow: { minHeight: 64, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft, padding: spacing.sm, justifyContent: "center" },
  activityRow: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft, padding: spacing.sm },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: colors.ink, ...typography.titleSm },
  rowSubtext: { color: colors.body, ...typography.bodySm },
  smallButton: { minWidth: 88, minHeight: 40, paddingHorizontal: spacing.sm },
  activityButton: { minWidth: 96, minHeight: 40, paddingHorizontal: spacing.sm },
  transactionScroll: { maxHeight: 380 },
  transactionList: { gap: spacing.sm },
  transactionRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft, padding: spacing.sm },
  transactionIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.canvas },
  transactionIconText: { fontSize: 20, fontWeight: "800" },
  transactionCopy: { flex: 1, minWidth: 0, gap: 2 },
  transactionTitle: { color: colors.ink, ...typography.titleSm },
  transactionMeta: { color: colors.body, ...typography.bodySm },
  activityStats: { gap: spacing.sm },
  activityStat: { borderWidth: 1, borderColor: colors.hairlineSoft, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft, padding: spacing.sm },
  statLabel: { color: colors.body, ...typography.caption },
  statValue: { marginTop: 2, color: colors.ink, fontSize: 20, fontWeight: "600", lineHeight: 26 },
});
