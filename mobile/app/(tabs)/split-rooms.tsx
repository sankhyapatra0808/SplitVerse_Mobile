import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import AmountText from "../../src/components/AmountText";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Avatar from "../../src/components/Avatar";
import EmptyState from "../../src/components/EmptyState";
import LoadingState from "../../src/components/LoadingState";
import Screen from "../../src/components/Screen";
import SheetModal from "../../src/components/SheetModal";
import { useAuth } from "../../src/context/AuthContext";
import {
  createSplitRoom,
  createSplitRoomItem,
  deleteSplitRoomItem,
  getFriendsSummary,
  getNetSettlements,
  getSplitRooms,
  payNetSettlement,
  updateSplitRoomItem,
  collectSplitRoomMemberDues,
  removeSplitRoomMember,
  sendSplitRoomReminder,
  archiveSplitRoom,
  deleteSplitRoom,
  finalizeSplitRoom,
  type SplitRoomBalance,
  type Friend,
  type NetSettlement,
  type NetSettlementsResponse,
  type SplitRoom,
  type SplitRoomItem,
  type SplitRoomMember,
} from "../../src/lib/api";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

const categoryOptions = [
  { label: "Restaurant", value: "restaurant" },
  { label: "Groceries", value: "groceries" },
  { label: "Trip", value: "trip" },
  { label: "Flatmates", value: "flatmates" },
  { label: "Rent", value: "rent" },
  { label: "Utilities", value: "utilities" },
  { label: "Subscription", value: "subscription" },
  { label: "Fuel", value: "fuel" },
  { label: "Shopping", value: "shopping" },
  { label: "Other", value: "other" },
];

function formatMoney(value?: number | null) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getMemberName(member?: SplitRoomMember) {
  if (!member) return "Member";
  if (member.isMe) return "Me";

  return (
    member.display_name ||
    member.name ||
    member.email?.split("@")[0] ||
    "Member"
  );
}

function getFriendName(friend: Friend) {
  return friend.name || friend.email.split("@")[0] || friend.email;
}

function getRoomPaidByEmail(room: SplitRoom) {
  return room.paidByEmail || room.paid_by_email || room.ownerEmail || "";
}

function getCategoryLabel(value?: string | null) {
  return (
    categoryOptions.find((category) => category.value === value)?.label ||
    "Other"
  );
}

function getItemPlaceholder(category?: string | null) {
  switch (category) {
    case "restaurant":
      return "Paneer tikka";
    case "groceries":
      return "Milk and bread";
    case "trip":
      return "Cab fare";
    case "flatmates":
      return "Cleaning supplies";
    case "rent":
      return "June rent";
    case "utilities":
      return "Electricity bill";
    case "subscription":
      return "Netflix";
    case "fuel":
      return "Petrol";
    case "shopping":
      return "Home essentials";
    default:
      return "Shared item";
  }
}

function isItemCollected(item: SplitRoomItem) {
  return Boolean(item.collected_at || item.expense_id || item.isCollected);
}

function getItemAssignedMemberId(item: SplitRoomItem) {
  return item.assignedMemberId || item.assigned_member_id;
}

function getBalanceAssignedAmount(balance: SplitRoomBalance) {
  return Number(
    balance.amount ?? balance.assignedTotal ?? balance.totalAssigned ?? 0,
  );
}

function getBalanceCollectedAmount(balance: SplitRoomBalance) {
  return Number(
    balance.collectedAmount ??
      balance.collectedTotal ??
      balance.paidTotal ??
      balance.totalPaid ??
      0,
  );
}

function getBalancePendingAmount(balance: SplitRoomBalance) {
  return Number(
    balance.outstandingAmount ??
      balance.pendingTotal ??
      balance.totalPending ??
      0,
  );
}

function getBalanceItemCount(balance: SplitRoomBalance) {
  return Number(balance.itemCount ?? 0);
}

function buildFallbackBalances(room: SplitRoom): SplitRoomBalance[] {
  return room.members.map((member) => {
    const memberItems = room.items.filter(
      (item) => getItemAssignedMemberId(item) === member.id,
    );

    const amount = memberItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );

    const collectedAmount = memberItems
      .filter((item) => isItemCollected(item))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const outstandingAmount = member.isMe
      ? 0
      : memberItems
          .filter((item) => !isItemCollected(item))
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      memberId: member.id,
      name: getMemberName(member),
      detail: member.isMe
        ? "Your spend"
        : outstandingAmount > 0
          ? "Dues pending"
          : collectedAmount > 0
            ? "Collected"
            : "No dues yet",
      amount,
      collectedAmount,
      outstandingAmount,
      isMe: member.isMe,
      isCollected: !member.isMe && amount > 0 && outstandingAmount === 0,
      itemCount: memberItems.length,
    };
  });
}

function buildOptimisticRoom({
  name,
  category,
  friendEmails,
  selfEmail,
  paidByEmail,
}: {
  name: string;
  category: string;
  friendEmails: string[];
  selfEmail: string;
  paidByEmail: string;
}): SplitRoom {
  const selfMember: SplitRoomMember = {
    id: "optimistic-self",
    email: selfEmail,
    display_name: "Me",
    isMe: true,
    isOwner: true,
  };

  const friendMembers: SplitRoomMember[] = friendEmails.map((email, index) => ({
    id: `optimistic-friend-${index}`,
    email,
    display_name: email.split("@")[0],
    isMe: false,
    isOwner: false,
  }));

  return {
    id: `optimistic-room-${Date.now()}`,
    name,
    category,
    status: "active",
    isOwner: true,
    paidByEmail,
    memberCount: friendMembers.length + 1,
    totalAmount: 0,
    outstandingAmount: 0,
    collectedAmount: 0,
    members: [selfMember, ...friendMembers],
    balances: [],
    items: [],
  };
}

function addOptimisticRoomItem({
  room,
  title,
  amount,
  assignedMemberId,
}: {
  room: SplitRoom;
  title: string;
  amount: number;
  assignedMemberId: string;
}): SplitRoom {
  const assignedMember = room.members.find(
    (member) => member.id === assignedMemberId,
  );

  const assignedToMe = Boolean(assignedMember?.isMe);

  const item: SplitRoomItem = {
    id: `optimistic-item-${Date.now()}`,
    room_id: room.id,
    assigned_member_id: assignedMemberId,
    assignedMemberId,
    title,
    amount,
    collected_at: assignedToMe ? new Date().toISOString() : null,
    isCollected: assignedToMe,
    created_at: new Date().toISOString(),
  };

  const nextTotal = Number(room.totalAmount || 0) + amount;
  const nextCollected =
    Number(room.collectedAmount || 0) + (assignedToMe ? amount : 0);

  return {
    ...room,
    items: [item, ...(room.items ?? [])],
    totalAmount: nextTotal,
    collectedAmount: nextCollected,
    outstandingAmount: Math.max(0, nextTotal - nextCollected),
  };
}

function updateOptimisticRoomItem({
  room,
  itemId,
  title,
  amount,
}: {
  room: SplitRoom;
  itemId: string;
  title: string;
  amount: number;
}): SplitRoom {
  const previousItem = room.items.find((item) => item.id === itemId);
  const previousAmount = Number(previousItem?.amount || 0);
  const difference = amount - previousAmount;
  const collected = previousItem ? isItemCollected(previousItem) : false;

  const nextTotal = Number(room.totalAmount || 0) + difference;
  const nextCollected =
    Number(room.collectedAmount || 0) + (collected ? difference : 0);

  return {
    ...room,
    items: room.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            title,
            amount,
          }
        : item,
    ),
    totalAmount: nextTotal,
    collectedAmount: nextCollected,
    outstandingAmount: Math.max(0, nextTotal - nextCollected),
  };
}

function removeOptimisticRoomItem(room: SplitRoom, itemId: string): SplitRoom {
  const item = room.items.find((entry) => entry.id === itemId);
  const amount = Number(item?.amount || 0);
  const collected = item ? isItemCollected(item) : false;

  const nextTotal = Number(room.totalAmount || 0) - amount;
  const nextCollected =
    Number(room.collectedAmount || 0) - (collected ? amount : 0);

  return {
    ...room,
    items: room.items.filter((entry) => entry.id !== itemId),
    totalAmount: Math.max(0, nextTotal),
    collectedAmount: Math.max(0, nextCollected),
    outstandingAmount: Math.max(0, nextTotal - nextCollected),
  };
}

export default function SplitRooms() {
  const { user, dbUser } = useAuth();

  const [rooms, setRooms] = useState<SplitRoom[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const selectedRoomIdRef = useRef("");

  const [roomName, setRoomName] = useState("");
  const [roomCategory, setRoomCategory] = useState("restaurant");
  const [roomPaidByEmail, setRoomPaidByEmail] = useState("");
  const [selectedFriendEmails, setSelectedFriendEmails] = useState<string[]>(
    [],
  );
  const [friendSearch, setFriendSearch] = useState("");

  const [itemTitle, setItemTitle] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [assignedMemberId, setAssignedMemberId] = useState("");

  const [editingItemId, setEditingItemId] = useState("");
  const [editItemTitle, setEditItemTitle] = useState("");
  const [editItemAmount, setEditItemAmount] = useState("");

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [friendModalOpen, setFriendModalOpen] = useState(false);
  const [paidByModalOpen, setPaidByModalOpen] = useState(false);
  const [assignMemberModalOpen, setAssignMemberModalOpen] = useState(false);
  const [editItemModalOpen, setEditItemModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingRoom, setSavingRoom] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState("");
  const [deletingItemId, setDeletingItemId] = useState("");

  const [memberBalanceTarget, setMemberBalanceTarget] =
    useState<SplitRoomBalance | null>(null);

  const [roomActionsOpen, setRoomActionsOpen] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState("");
  const [finalizingRoomId, setFinalizingRoomId] = useState("");
  const [archivingRoomId, setArchivingRoomId] = useState("");
  const [collectingMemberId, setCollectingMemberId] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState("");
  const [remindingRoomId, setRemindingRoomId] = useState("");

  const [netSettlements, setNetSettlements] =
    useState<NetSettlementsResponse | null>(null);
  const [netSettlementInfoDialog, setNetSettlementInfoDialog] = useState<
    "payable" | "receivable" | null
  >(null);
  const [netSettlementTarget, setNetSettlementTarget] =
    useState<NetSettlement | null>(null);
  const [walletPin, setWalletPin] = useState("");
  const [payingNetSettlementUserId, setPayingNetSettlementUserId] =
    useState("");

  const selfEmail = dbUser?.email || user?.email || "";

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? rooms[0],
    [rooms, selectedRoomId],
  );

  const sortedMembers = useMemo(() => {
    if (!selectedRoom) return [];

    return [...(selectedRoom.members ?? [])].sort((left, right) => {
      if (left.isMe) return -1;
      if (right.isMe) return 1;
      return getMemberName(left).localeCompare(getMemberName(right));
    });
  }, [selectedRoom]);

  const selectedRoomItems = selectedRoom?.items ?? [];

  const selectedMemberBalances = useMemo(() => {
    if (!selectedRoom) {
      return [];
    }

    const balances =
      selectedRoom.balances && selectedRoom.balances.length > 0
        ? selectedRoom.balances
        : buildFallbackBalances(selectedRoom);

    return [...balances].sort((left, right) => {
      const leftMember = selectedRoom.members.find(
        (member) => member.id === left.memberId,
      );
      const rightMember = selectedRoom.members.find(
        (member) => member.id === right.memberId,
      );

      if (leftMember?.isMe) return -1;
      if (rightMember?.isMe) return 1;

      return String(left.name ?? "").localeCompare(String(right.name ?? ""));
    });
  }, [selectedRoom]);

  const selectedRoomMyPendingItems = useMemo(() => {
    if (!selectedRoom) {
      return [];
    }

    const me = selectedRoom.members.find((member) => member.isMe);

    if (!me) {
      return [];
    }

    return selectedRoom.items.filter(
      (item) =>
        getItemAssignedMemberId(item) === me.id && !isItemCollected(item),
    );
  }, [selectedRoom]);

  const selectedRoomMyPendingTotal = selectedRoomMyPendingItems.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const selectedRoomHasMemberPendingDues = selectedMemberBalances.some(
    (balance) => !balance.isMe && getBalancePendingAmount(balance) > 0,
  );

  const allNetSettlements = netSettlements?.settlements ?? [];

  const outgoingNetSettlements = allNetSettlements.filter(
    (settlement) => settlement.isOutgoing,
  );

  const incomingNetSettlements = allNetSettlements.filter(
    (settlement) => settlement.isIncoming,
  );

  const netSettlementOutgoingTotal =
    netSettlements?.summary.outgoingTotal ??
    outgoingNetSettlements.reduce(
      (sum, settlement) => sum + Number(settlement.amount || 0),
      0,
    );

  const netSettlementIncomingTotal =
    netSettlements?.summary.incomingTotal ??
    incomingNetSettlements.reduce(
      (sum, settlement) => sum + Number(settlement.amount || 0),
      0,
    );

  const visibleNetSettlements =
    netSettlementInfoDialog === "payable"
      ? outgoingNetSettlements
      : incomingNetSettlements;

  const visibleNetSettlementTotal =
    netSettlementInfoDialog === "payable"
      ? netSettlementOutgoingTotal
      : netSettlementIncomingTotal;

  const selectedRoomClosed = Boolean(
    selectedRoom?.isArchived ||
    selectedRoom?.isFinalized ||
    selectedRoom?.status === "archived" ||
    selectedRoom?.status === "finalized",
  );

  const selectedAssignedMember = useMemo(
    () => sortedMembers.find((member) => member.id === assignedMemberId),
    [assignedMemberId, sortedMembers],
  );

  const filteredFriends = useMemo(() => {
    const search = friendSearch.trim().toLowerCase();

    if (!search) return friends;

    return friends.filter((friend) =>
      `${friend.name ?? ""} ${friend.email}`.toLowerCase().includes(search),
    );
  }, [friendSearch, friends]);

  const selectedFriendNames = useMemo(() => {
    if (selectedFriendEmails.length === 0) return "Select friends";

    return selectedFriendEmails
      .map((email) => {
        const friend = friends.find((item) => item.email === email);
        return friend ? getFriendName(friend) : email.split("@")[0];
      })
      .join(", ");
  }, [friends, selectedFriendEmails]);

  const paidByOptions = useMemo(() => {
    const selectedFriends = friends.filter((friend) =>
      selectedFriendEmails.includes(friend.email),
    );

    return [
      {
        email: selfEmail,
        name: "Me",
      },
      ...selectedFriends.map((friend) => ({
        email: friend.email,
        name: getFriendName(friend),
      })),
    ].filter((item) => Boolean(item.email));
  }, [friends, selectedFriendEmails, selfEmail]);

  const paidByLabel = useMemo(() => {
    const selected = paidByOptions.find(
      (item) => item.email === roomPaidByEmail,
    );
    return selected?.name || "Me";
  }, [paidByOptions, roomPaidByEmail]);

  const itemPlaceholder = getItemPlaceholder(selectedRoom?.category);

  const loadSplitRoomData = useCallback(
    async (preferredRoomId?: string, silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const [roomData, friendsData, settlementData] = await Promise.all([
          getSplitRooms(),
          getFriendsSummary(),
          getNetSettlements(),
        ]);

        const nextRooms = roomData.rooms ?? [];
        const currentSelectedRoomId = selectedRoomIdRef.current;

        const nextRoomId =
          preferredRoomId ||
          (nextRooms.some((room) => room.id === currentSelectedRoomId)
            ? currentSelectedRoomId
            : nextRooms[0]?.id || "");

        setRooms(nextRooms);
        setFriends(friendsData.friends ?? []);
        setNetSettlements(settlementData);

        selectedRoomIdRef.current = nextRoomId;
        setSelectedRoomId(nextRoomId);
      } catch (error) {
        if (!silent) {
          Alert.alert(
            "Rooms failed",
            error instanceof Error
              ? error.message
              : "Could not load split rooms",
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadSplitRoomData();
  }, [loadSplitRoomData]);

  useFocusEffect(
    useCallback(() => {
      void loadSplitRoomData(undefined, true);
    }, [loadSplitRoomData]),
  );

  useEffect(() => {
    if (!roomPaidByEmail && selfEmail) {
      setRoomPaidByEmail(selfEmail);
    }
  }, [roomPaidByEmail, selfEmail]);

  useEffect(() => {
    setMemberBalanceTarget(null);
    setRoomActionsOpen(false);
  }, [selectedRoomId]);

  useEffect(() => {
    if (
      roomPaidByEmail &&
      !paidByOptions.some((item) => item.email === roomPaidByEmail)
    ) {
      setRoomPaidByEmail(selfEmail);
    }
  }, [paidByOptions, roomPaidByEmail, selfEmail]);

  useEffect(() => {
    if (!selectedRoom || sortedMembers.length === 0) {
      setAssignedMemberId("");
      return;
    }

    if (!sortedMembers.some((member) => member.id === assignedMemberId)) {
      setAssignedMemberId(sortedMembers[0].id);
    }
  }, [assignedMemberId, selectedRoom, sortedMembers]);

  function toggleSelectedFriend(email: string) {
    setSelectedFriendEmails((previous) =>
      previous.includes(email)
        ? previous.filter((item) => item !== email)
        : [...previous, email],
    );
  }

  function resetCreateForm() {
    setRoomName("");
    setSelectedFriendEmails([]);
    setFriendSearch("");
    setRoomCategory("restaurant");
    setRoomPaidByEmail(selfEmail);
    setFriendModalOpen(false);
    setCategoryModalOpen(false);
    setPaidByModalOpen(false);
  }

  async function handleCreateRoom() {
    const nextRoomName = roomName.trim();
    const nextFriendEmails = selectedFriendEmails;
    const nextPaidByEmail = roomPaidByEmail || selfEmail;

    if (!nextRoomName) {
      Alert.alert("Room name required", "Enter a name for this split room.");
      return;
    }

    if (nextFriendEmails.length === 0) {
      Alert.alert(
        "Select friends",
        "Select at least one friend for this room.",
      );
      return;
    }

    const previousRooms = rooms;
    const previousSelectedRoomId = selectedRoomId;

    const optimisticRoom = buildOptimisticRoom({
      name: nextRoomName,
      category: roomCategory,
      friendEmails: nextFriendEmails,
      selfEmail,
      paidByEmail: nextPaidByEmail,
    });

    try {
      setSavingRoom(true);
      setRooms((previous) => [optimisticRoom, ...previous]);
      selectedRoomIdRef.current = optimisticRoom.id;
      setSelectedRoomId(optimisticRoom.id);
      resetCreateForm();

      const response = await createSplitRoom({
        name: nextRoomName,
        category: roomCategory,
        members: nextFriendEmails,
        paidByEmail: nextPaidByEmail,
      });

      await loadSplitRoomData(response.room.id, true);
      Alert.alert("Room created", "Room added to your active rooms.");
    } catch (error) {
      setRooms(previousRooms);
      setSelectedRoomId(previousSelectedRoomId);
      setRoomName(nextRoomName);
      setSelectedFriendEmails(nextFriendEmails);
      setRoomPaidByEmail(nextPaidByEmail);

      Alert.alert(
        "Create room failed",
        error instanceof Error ? error.message : "Failed to create room",
      );
    } finally {
      setSavingRoom(false);
    }
  }

  async function handleAddItem() {
    if (!selectedRoom) {
      Alert.alert("Create a room first", "Create or select a room first.");
      return;
    }

    if (!selectedRoom.isOwner) {
      Alert.alert("Only host can add", "Only the room owner can add items.");
      return;
    }

    if (selectedRoomClosed) {
      Alert.alert("Room closed", "Items cannot be added to a closed room.");
      return;
    }

    const nextTitle = itemTitle.trim();
    const nextAmount = Number(itemAmount);

    if (!nextTitle) {
      Alert.alert("Item name required", "Enter the item name.");
      return;
    }

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      Alert.alert("Invalid amount", "Amount must be greater than 0.");
      return;
    }

    if (!assignedMemberId) {
      Alert.alert("Choose member", "Choose who this item is assigned to.");
      return;
    }

    const previousRooms = rooms;
    const previousTitle = itemTitle;
    const previousAmount = itemAmount;
    const previousAssignedMemberId = assignedMemberId;
    const assignedMember = sortedMembers.find(
      (member) => member.id === assignedMemberId,
    );

    try {
      setSavingItem(true);

      setRooms((previous) =>
        previous.map((room) =>
          room.id === selectedRoom.id
            ? addOptimisticRoomItem({
                room,
                title: nextTitle,
                amount: nextAmount,
                assignedMemberId,
              })
            : room,
        ),
      );

      setItemTitle("");
      setItemAmount("");

      await createSplitRoomItem(selectedRoom.id, {
        title: nextTitle,
        amount: nextAmount,
        assignedMemberId,
      });

      await loadSplitRoomData(selectedRoom.id, true);

      Alert.alert(
        assignedMember?.isMe ? "Expense added" : "Due added",
        assignedMember?.isMe
          ? "This item was added as your expense."
          : "This item was assigned as a due.",
      );
    } catch (error) {
      setRooms(previousRooms);
      setItemTitle(previousTitle);
      setItemAmount(previousAmount);
      setAssignedMemberId(previousAssignedMemberId);

      Alert.alert(
        "Add item failed",
        error instanceof Error ? error.message : "Failed to add item",
      );
    } finally {
      setSavingItem(false);
    }
  }

  function openEditItem(item: SplitRoomItem) {
    if (isItemCollected(item)) {
      Alert.alert("Item locked", "Collected items cannot be edited.");
      return;
    }

    setEditingItemId(item.id);
    setEditItemTitle(item.title);
    setEditItemAmount(String(item.amount));
    setEditItemModalOpen(true);
  }

  async function handleSaveEditedItem() {
    if (!selectedRoom || !editingItemId) return;

    const nextTitle = editItemTitle.trim();
    const nextAmount = Number(editItemAmount);

    if (!nextTitle) {
      Alert.alert("Item name required", "Enter the item name.");
      return;
    }

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      Alert.alert("Invalid amount", "Amount must be greater than 0.");
      return;
    }

    const previousRooms = rooms;

    try {
      setUpdatingItemId(editingItemId);

      setRooms((previous) =>
        previous.map((room) =>
          room.id === selectedRoom.id
            ? updateOptimisticRoomItem({
                room,
                itemId: editingItemId,
                title: nextTitle,
                amount: nextAmount,
              })
            : room,
        ),
      );

      await updateSplitRoomItem(editingItemId, {
        title: nextTitle,
        amount: nextAmount,
      });

      setEditItemModalOpen(false);
      setEditingItemId("");
      setEditItemTitle("");
      setEditItemAmount("");

      await loadSplitRoomData(selectedRoom.id, true);
      Alert.alert("Item updated", "Split item updated successfully.");
    } catch (error) {
      setRooms(previousRooms);

      Alert.alert(
        "Update failed",
        error instanceof Error ? error.message : "Failed to update item",
      );
    } finally {
      setUpdatingItemId("");
    }
  }

  function requestDeleteItem(item: SplitRoomItem) {
    if (isItemCollected(item)) {
      Alert.alert("Item locked", "Collected items cannot be deleted.");
      return;
    }

    Alert.alert("Delete item", `Remove "${item.title}" from this room?`, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void handleDeleteItem(item);
        },
      },
    ]);
  }

  async function handleDeleteItem(item: SplitRoomItem) {
    if (!selectedRoom) return;

    const previousRooms = rooms;

    try {
      setDeletingItemId(item.id);

      setRooms((previous) =>
        previous.map((room) =>
          room.id === selectedRoom.id
            ? removeOptimisticRoomItem(room, item.id)
            : room,
        ),
      );

      await deleteSplitRoomItem(item.id);
      await loadSplitRoomData(selectedRoom.id, true);

      Alert.alert("Item deleted", "Split item removed from this room.");
    } catch (error) {
      setRooms(previousRooms);

      Alert.alert(
        "Delete failed",
        error instanceof Error ? error.message : "Failed to delete item",
      );
    } finally {
      setDeletingItemId("");
    }
  }

  function getSettlementCounterparty(settlement: NetSettlement) {
    return settlement.isOutgoing
      ? settlement.toName || settlement.toEmail
      : settlement.fromName || settlement.fromEmail;
  }

  function openNetSettlementPinDialog(settlement: NetSettlement) {
    setNetSettlementInfoDialog(null);
    setNetSettlementTarget(settlement);
    setWalletPin("");
  }

  function closeNetSettlementPinDialog() {
    setNetSettlementTarget(null);
    setWalletPin("");
    setPayingNetSettlementUserId("");
  }

  async function handleConfirmNetSettlementPayment() {
    if (!netSettlementTarget) {
      return;
    }

    const pin = walletPin.trim();

    if (!pin) {
      Alert.alert("Wallet PIN required", "Enter your wallet PIN to continue.");
      return;
    }

    try {
      setPayingNetSettlementUserId(netSettlementTarget.toUserId);

      await payNetSettlement({
        toUserId: netSettlementTarget.toUserId,
        walletPin: pin,
      });

      closeNetSettlementPinDialog();
      await loadSplitRoomData(selectedRoom?.id, true);

      Alert.alert(
        "Payment complete",
        "Final net settlement has been paid successfully.",
      );
    } catch (error) {
      Alert.alert(
        "Payment failed",
        error instanceof Error ? error.message : "Could not complete payment",
      );
    } finally {
      setPayingNetSettlementUserId("");
    }
  }

  function getBalanceMember(balance: SplitRoomBalance) {
    return selectedRoom?.members.find(
      (member) => member.id === balance.memberId,
    );
  }

  function canRemoveMember(member?: SplitRoomMember) {
    if (!selectedRoom || !member) {
      return false;
    }

    const assignedItemCount = selectedRoom.items.filter(
      (item) => getItemAssignedMemberId(item) === member.id,
    ).length;

    return Boolean(
      selectedRoom.isOwner &&
      !selectedRoomClosed &&
      !member.isMe &&
      !member.isOwner &&
      assignedItemCount === 0,
    );
  }

  async function handleCollectMemberDues(memberId: string) {
    if (!selectedRoom) {
      return;
    }

    try {
      setCollectingMemberId(memberId);

      const response = await collectSplitRoomMemberDues(
        selectedRoom.id,
        memberId,
      );

      await loadSplitRoomData(selectedRoom.id, true);

      Alert.alert(
        "Manual collect complete",
        response.updatedCount > 0
          ? "Dues marked as collected."
          : "There were no pending dues for this member.",
      );
    } catch (error) {
      Alert.alert(
        "Collect failed",
        error instanceof Error
          ? error.message
          : "Failed to mark dues collected",
      );
    } finally {
      setCollectingMemberId("");
    }
  }

  function requestCollectMemberDues(balance: SplitRoomBalance) {
    const member = getBalanceMember(balance);

    if (!selectedRoom || !member) {
      return;
    }

    Alert.alert(
      "Manual collect",
      `Mark pending dues from ${getMemberName(member)} as collected? Use this only when payment was completed outside the app.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Collect",
          onPress: () => {
            void handleCollectMemberDues(member.id);
          },
        },
      ],
    );
  }

  async function handleSendRoomReminder() {
    if (!selectedRoom) {
      return;
    }

    try {
      setRemindingRoomId(selectedRoom.id);

      const response = await sendSplitRoomReminder(selectedRoom.id);

      Alert.alert(
        "Reminder sent",
        response.message ||
          `Reminder sent to ${response.remindedCount || 0} member(s).`,
      );
    } catch (error) {
      Alert.alert(
        "Reminder failed",
        error instanceof Error ? error.message : "Failed to send reminder",
      );
    } finally {
      setRemindingRoomId("");
    }
  }

  function requestSendRoomReminder() {
    if (!selectedRoom) {
      return;
    }

    Alert.alert(
      "Send reminder",
      `Send a reminder for pending dues in ${selectedRoom.name}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Send",
          onPress: () => {
            void handleSendRoomReminder();
          },
        },
      ],
    );
  }

  async function handleRemoveMember(member: SplitRoomMember) {
    if (!selectedRoom) {
      return;
    }

    try {
      setRemovingMemberId(member.id);

      await removeSplitRoomMember(selectedRoom.id, member.id);
      await loadSplitRoomData(selectedRoom.id, true);

      Alert.alert("Member removed", `${getMemberName(member)} was removed.`);
    } catch (error) {
      Alert.alert(
        "Remove failed",
        error instanceof Error ? error.message : "Failed to remove member",
      );
    } finally {
      setRemovingMemberId("");
    }
  }

  function requestRemoveMember(member: SplitRoomMember) {
    if (!selectedRoom) {
      return;
    }

    Alert.alert(
      "Remove member",
      `Remove ${getMemberName(member)} from ${selectedRoom.name}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void handleRemoveMember(member);
          },
        },
      ],
    );
  }

  function canManageSelectedRoom() {
    return Boolean(selectedRoom?.isOwner);
  }

  function selectedRoomHasOutstandingAmount() {
    return Number(selectedRoom?.outstandingAmount || 0) > 0;
  }

  async function handleDeleteRoom() {
    if (!selectedRoom) return;

    try {
      setDeletingRoomId(selectedRoom.id);
      await deleteSplitRoom(selectedRoom.id);

      setSelectedRoomId("");
      selectedRoomIdRef.current = "";

      await loadSplitRoomData(undefined, true);
      setRoomActionsOpen(false);

      Alert.alert("Room deleted", "The split room was deleted.");
    } catch (error) {
      Alert.alert(
        "Delete failed",
        error instanceof Error ? error.message : "Could not delete room",
      );
    } finally {
      setDeletingRoomId("");
    }
  }

  function requestDeleteRoom() {
    if (!selectedRoom) return;

    if (!selectedRoom.isOwner) {
      Alert.alert("Only host can delete", "Only the room owner can delete it.");
      return;
    }

    if (selectedRoomHasOutstandingAmount()) {
      Alert.alert(
        "Settle dues first",
        "All pending dues must be settled before deleting this room.",
      );
      return;
    }

    Alert.alert("Delete room", `Delete "${selectedRoom.name}" permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void handleDeleteRoom();
        },
      },
    ]);
  }

  async function handleFinalizeRoom() {
    if (!selectedRoom) return;

    try {
      setFinalizingRoomId(selectedRoom.id);
      await finalizeSplitRoom(selectedRoom.id);

      await loadSplitRoomData(selectedRoom.id, true);
      setRoomActionsOpen(false);

      Alert.alert("Room finalized", "This room has been finalized.");
    } catch (error) {
      Alert.alert(
        "Finalize failed",
        error instanceof Error ? error.message : "Could not finalize room",
      );
    } finally {
      setFinalizingRoomId("");
    }
  }

  function requestFinalizeRoom() {
    if (!selectedRoom) return;

    if (!selectedRoom.isOwner) {
      Alert.alert(
        "Only host can finalize",
        "Only the room owner can finalize it.",
      );
      return;
    }

    if (selectedRoomHasOutstandingAmount()) {
      Alert.alert(
        "Settle dues first",
        "All pending dues must be settled before finalizing this room.",
      );
      return;
    }

    Alert.alert(
      "Finalize room",
      `Finalize "${selectedRoom.name}"? Items cannot be changed after this.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Finalize",
          onPress: () => {
            void handleFinalizeRoom();
          },
        },
      ],
    );
  }

  async function handleArchiveRoom() {
    if (!selectedRoom) return;

    try {
      setArchivingRoomId(selectedRoom.id);
      await archiveSplitRoom(selectedRoom.id);

      await loadSplitRoomData(selectedRoom.id, true);
      setRoomActionsOpen(false);

      Alert.alert("Room archived", "This room has been archived.");
    } catch (error) {
      Alert.alert(
        "Archive failed",
        error instanceof Error ? error.message : "Could not archive room",
      );
    } finally {
      setArchivingRoomId("");
    }
  }

  function requestArchiveRoom() {
    if (!selectedRoom) return;

    if (!selectedRoom.isOwner) {
      Alert.alert(
        "Only host can archive",
        "Only the room owner can archive it.",
      );
      return;
    }

    Alert.alert("Archive room", `Archive "${selectedRoom.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        onPress: () => {
          void handleArchiveRoom();
        },
      },
    ]);
  }

  return (
    <Screen
      refreshing={loading}
      onRefresh={() => loadSplitRoomData()}
      contentStyle={styles.screen}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Item-wise splitting</Text>
        <Text style={styles.title}>Rooms</Text>
        <Text style={styles.subtitle}>
          Create rooms, assign items to the right person, and keep every bill
          fair.
        </Text>
      </View>

      <AppCard style={styles.createCard}>
        <Text style={styles.cardEyebrow}>Create room</Text>
        <Text style={styles.cardTitle}>Start a new split</Text>

        <AppTextInput
          label="Room name"
          value={roomName}
          onChangeText={setRoomName}
          placeholder="Dinner at Park Street"
          editable={!savingRoom}
        />

        <Pressable
          style={styles.selector}
          onPress={() => setFriendModalOpen(true)}
          disabled={savingRoom}
        >
          <View style={styles.selectorCopy}>
            <Text style={styles.selectorLabel}>Friends</Text>
            <Text style={styles.selectorValue} numberOfLines={1}>
              {selectedFriendNames}
            </Text>
          </View>
          <Text style={styles.selectorAction}>Choose</Text>
        </Pressable>

        <Pressable
          style={styles.selector}
          onPress={() => setCategoryModalOpen(true)}
          disabled={savingRoom}
        >
          <View style={styles.selectorCopy}>
            <Text style={styles.selectorLabel}>Category</Text>
            <Text style={styles.selectorValue}>
              {getCategoryLabel(roomCategory)}
            </Text>
          </View>
          <Text style={styles.selectorAction}>Change</Text>
        </Pressable>

        <Pressable
          style={styles.selector}
          onPress={() => setPaidByModalOpen(true)}
          disabled={savingRoom}
        >
          <View style={styles.selectorCopy}>
            <Text style={styles.selectorLabel}>Paid by</Text>
            <Text style={styles.selectorValue} numberOfLines={1}>
              {paidByLabel}
            </Text>
          </View>
          <Text style={styles.selectorAction}>Change</Text>
        </Pressable>

        <AppButton
          title={savingRoom ? "Creating room" : "Create room"}
          loading={savingRoom}
          onPress={handleCreateRoom}
        />
      </AppCard>

      <AppCard style={styles.roomsCard}>
        <View style={styles.cardHeadRow}>
          <View>
            <Text style={styles.cardEyebrow}>Rooms</Text>
            <Text style={styles.cardTitle}>Active rooms</Text>
          </View>
          <Text style={styles.countPill}>{rooms.length}</Text>
        </View>

        {loading ? (
          <LoadingState label="Loading rooms..." />
        ) : rooms.length === 0 ? (
          <EmptyState
            title="Create your first split room"
            message="Rooms you create or join will appear here."
          />
        ) : (
          <View style={styles.roomList}>
            {rooms.map((room) => {
              const active = selectedRoom?.id === room.id;

              return (
                <Pressable
                  key={room.id}
                  style={[styles.roomRow, active && styles.activeRoomRow]}
                  onPress={() => {
                    selectedRoomIdRef.current = room.id;
                    setSelectedRoomId(room.id);
                  }}
                >
                  <View style={styles.roomMain}>
                    <Text style={styles.roomName} numberOfLines={1}>
                      {room.name}
                    </Text>
                    <Text style={styles.roomMeta} numberOfLines={1}>
                      {room.memberCount ?? room.members?.length ?? 0} members
                      {room.isOwner ? " · Owner" : ""}
                    </Text>
                  </View>

                  <View style={styles.roomAmountBox}>
                    <AmountText
                      amount={room.outstandingAmount ?? 0}
                      size="sm"
                      tone={
                        (room.outstandingAmount ?? 0) > 0 ? "danger" : "success"
                      }
                    />
                    <Text style={styles.roomDueText}>due</Text>
                  </View>

                  <Text style={styles.statusPill}>
                    {room.status || "active"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </AppCard>

      <AppCard style={styles.addItemCard}>
        <Text style={styles.cardEyebrow}>Add item</Text>
        <Text style={styles.cardTitle}>
          {selectedRoom ? `Assign in ${selectedRoom.name}` : "No room selected"}
        </Text>

        {!selectedRoom ? (
          <EmptyState
            title="Create a room first"
            message="After creating a room, you can assign items member by member."
          />
        ) : !selectedRoom.isOwner ? (
          <EmptyState
            title="Only host can add items"
            message="You can view this room, but only the room owner can add or edit items."
          />
        ) : selectedRoomClosed ? (
          <EmptyState
            title="Room is closed"
            message="Finalized or archived rooms cannot accept new items."
          />
        ) : (
          <>
            <AppTextInput
              label="Item"
              value={itemTitle}
              onChangeText={setItemTitle}
              placeholder={itemPlaceholder}
              editable={!savingItem}
            />

            <AppTextInput
              label="Amount"
              value={itemAmount}
              onChangeText={setItemAmount}
              placeholder={formatMoney(420)}
              keyboardType="decimal-pad"
              editable={!savingItem}
            />

            <Pressable
              style={styles.selector}
              onPress={() => setAssignMemberModalOpen(true)}
              disabled={savingItem || sortedMembers.length === 0}
            >
              <View style={styles.selectorCopy}>
                <Text style={styles.selectorLabel}>Assign to</Text>
                <Text style={styles.selectorValue} numberOfLines={1}>
                  {selectedAssignedMember
                    ? getMemberName(selectedAssignedMember)
                    : "Choose member"}
                </Text>
              </View>
              <Text style={styles.selectorAction}>Choose</Text>
            </Pressable>

            <AppButton
              title={savingItem ? "Adding item" : "Add item"}
              loading={savingItem}
              onPress={handleAddItem}
            />
          </>
        )}
      </AppCard>

      <AppCard style={styles.detailsCard}>
        <Text style={styles.cardEyebrow}>Selected room</Text>
        <Text style={styles.cardTitle}>
          {selectedRoom ? selectedRoom.name : "No room selected"}
        </Text>

        {selectedRoom && canManageSelectedRoom() ? (
          <Pressable
            style={styles.roomActionsButton}
            onPress={() => setRoomActionsOpen(true)}
          >
            <Text style={styles.roomActionsButtonText}>Room actions</Text>
          </Pressable>
        ) : null}

        {!selectedRoom ? (
          <EmptyState
            title="No active room"
            message="Create a room to see its summary."
          />
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Total</Text>
                <AmountText
                  amount={selectedRoom.totalAmount ?? 0}
                  size="sm"
                  tone="primary"
                />
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Outstanding</Text>
                <AmountText
                  amount={selectedRoom.outstandingAmount ?? 0}
                  size="sm"
                  tone={
                    (selectedRoom.outstandingAmount ?? 0) > 0
                      ? "danger"
                      : "success"
                  }
                />
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Collected</Text>
                <AmountText
                  amount={selectedRoom.collectedAmount ?? 0}
                  size="sm"
                  tone="success"
                />
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Paid by</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {getRoomPaidByEmail(selectedRoom) || "Host"}
                </Text>
              </View>
            </View>

            <View style={styles.membersSection}>
              <View style={styles.cardHeadRow}>
                <View>
                  <Text style={styles.cardEyebrow}>Members</Text>
                  <Text style={styles.cardTitleSmall}>Room members</Text>
                </View>
                <Text style={styles.countPill}>
                  {selectedRoom.memberCount ?? sortedMembers.length}
                </Text>
              </View>

              <View style={styles.memberList}>
                {sortedMembers.map((member) => (
                  <View style={styles.memberRow} key={member.id}>
                    <Avatar
                      name={getMemberName(member)}
                      email={member.email}
                      imageUrl={
                        member.display_photo_url ||
                        member.profile_photo_url ||
                        member.photo_url
                      }
                      size={42}
                    />

                    <View style={styles.memberCopy}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {getMemberName(member)}
                      </Text>
                      <Text style={styles.memberEmail} numberOfLines={1}>
                        {member.email}
                      </Text>
                    </View>

                    {member.isOwner ? (
                      <Text style={styles.memberRole}>Host</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </AppCard>

      <AppCard style={styles.memberBalanceCard}>
        <View style={styles.cardHeadRow}>
          <View>
            <Text style={styles.cardEyebrow}>Members</Text>
            <Text style={styles.cardTitle}>Member balances</Text>
          </View>

          {selectedRoom?.isOwner && selectedRoomHasMemberPendingDues ? (
            <Pressable
              style={styles.reminderButton}
              onPress={requestSendRoomReminder}
              disabled={remindingRoomId === selectedRoom?.id}
            >
              <Text style={styles.reminderButtonText}>
                {remindingRoomId === selectedRoom?.id ? "Sending" : "Remind"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {!selectedRoom ? (
          <EmptyState
            title="No room selected"
            message="Select a room to view member balances."
          />
        ) : selectedMemberBalances.length === 0 ? (
          <EmptyState
            title="No member balances"
            message="Add items to see member-wise assigned and pending amounts."
          />
        ) : (
          <View style={styles.memberBalanceList}>
            {selectedMemberBalances.map((balance) => {
              const member = getBalanceMember(balance);
              const assignedAmount = getBalanceAssignedAmount(balance);
              const pendingAmount = getBalancePendingAmount(balance);

              return (
                <Pressable
                  key={balance.memberId}
                  style={[
                    styles.memberBalanceRow,
                    pendingAmount > 0 && styles.memberBalanceRowPending,
                  ]}
                  onPress={() => setMemberBalanceTarget(balance)}
                >
                  <View style={styles.memberBalanceTop}>
                    <Avatar
                      name={member ? getMemberName(member) : balance.name}
                      email={member?.email}
                      imageUrl={
                        member?.display_photo_url ||
                        member?.profile_photo_url ||
                        member?.photo_url
                      }
                      size={44}
                    />

                    <View style={styles.memberBalanceCopy}>
                      <Text style={styles.memberBalanceName} numberOfLines={1}>
                        {balance.name ||
                          (member ? getMemberName(member) : "Member")}
                      </Text>

                      <Text
                        style={styles.memberBalanceDetail}
                        numberOfLines={1}
                      >
                        {balance.detail ||
                          (pendingAmount > 0
                            ? "Dues pending"
                            : assignedAmount > 0
                              ? "Settled"
                              : "No dues yet")}
                      </Text>
                    </View>

                    <View style={styles.memberBalanceAmountBox}>
                      <AmountText
                        amount={
                          pendingAmount > 0 ? pendingAmount : assignedAmount
                        }
                        size="sm"
                        tone={
                          pendingAmount > 0
                            ? "danger"
                            : assignedAmount > 0
                              ? "success"
                              : "default"
                        }
                      />
                      <Text style={styles.memberBalanceAmountLabel}>
                        {pendingAmount > 0 ? "pending" : "assigned"}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </AppCard>

      <AppCard style={styles.pendingDuesCard}>
        <View style={styles.cardHeadRow}>
          <View>
            <Text style={styles.cardEyebrow}>Your dues</Text>
            <Text style={styles.cardTitle}>Pending in this room</Text>
          </View>

          <AmountText
            amount={selectedRoomMyPendingTotal}
            size="sm"
            tone={selectedRoomMyPendingTotal > 0 ? "danger" : "success"}
          />
        </View>

        {!selectedRoom ? (
          <EmptyState title="No room selected" />
        ) : selectedRoomMyPendingItems.length === 0 ? (
          <EmptyState
            title="No pending dues"
            message="Items assigned to you and not collected will appear here."
          />
        ) : (
          <View style={styles.myDueList}>
            {selectedRoomMyPendingItems.map((item) => (
              <View style={styles.myDueRow} key={item.id}>
                <View style={styles.memberBalanceCopy}>
                  <Text style={styles.memberBalanceName} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.memberBalanceDetail}>
                    Assigned to you
                  </Text>
                </View>

                <AmountText amount={item.amount} size="sm" tone="danger" />
              </View>
            ))}
          </View>
        )}
      </AppCard>

      <AppCard style={styles.historyCard}>
        <View style={styles.cardHeadRow}>
          <View>
            <Text style={styles.cardEyebrow}>Split history</Text>
            <Text style={styles.cardTitle}>
              {selectedRoom ? selectedRoom.name : "No room selected"}
            </Text>
          </View>
          <Text style={styles.countPill}>{selectedRoomItems.length}</Text>
        </View>

        {!selectedRoom ? (
          <EmptyState title="No room selected" />
        ) : selectedRoomItems.length === 0 ? (
          <EmptyState
            title="No items yet"
            message="Add the first item and assign it to the person who used it."
          />
        ) : (
          <View style={styles.itemList}>
            {selectedRoomItems.map((item) => {
              const assignedMember = sortedMembers.find(
                (member) => member.id === getItemAssignedMemberId(item),
              );

              const collected = isItemCollected(item);
              const canManage = Boolean(selectedRoom.isOwner && !collected);

              return (
                <View style={styles.itemRow} key={item.id}>
                  <View style={styles.itemTopRow}>
                    <View style={styles.itemCopy}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.itemSubtext} numberOfLines={1}>
                        Assigned to{" "}
                        {assignedMember
                          ? getMemberName(assignedMember)
                          : "Member"}
                      </Text>
                    </View>

                    <AmountText
                      amount={item.amount}
                      size="sm"
                      tone={collected ? "success" : "danger"}
                    />
                  </View>

                  <View style={styles.itemFooter}>
                    <Text
                      style={[
                        styles.itemStatus,
                        collected ? styles.itemCollected : styles.itemPending,
                      ]}
                    >
                      {collected ? "Collected" : "Pending"}
                    </Text>

                    {canManage ? (
                      <View style={styles.itemActions}>
                        <Pressable
                          style={styles.itemActionButton}
                          onPress={() => openEditItem(item)}
                          disabled={updatingItemId === item.id}
                        >
                          <Text style={styles.itemActionText}>
                            {updatingItemId === item.id ? "Saving" : "Edit"}
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.itemActionButton,
                            styles.deleteActionButton,
                          ]}
                          onPress={() => requestDeleteItem(item)}
                          disabled={deletingItemId === item.id}
                        >
                          <Text
                            style={[
                              styles.itemActionText,
                              styles.deleteActionText,
                            ]}
                          >
                            {deletingItemId === item.id ? "Deleting" : "Delete"}
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Text style={styles.lockedText}>
                        {collected ? "Locked" : "View only"}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </AppCard>

      <AppCard style={styles.netSettlementCard}>
        <View style={styles.cardHeadRow}>
          <View style={styles.netSettlementHeadCopy}>
            <Text style={styles.cardEyebrow}>Adjusted settlements</Text>
            <Text style={styles.cardTitle}>Final payable after adjustment</Text>
            <Text style={styles.netSettlementNote}>
              SplitVerse cancels opposite dues between the same friends first,
              then shows only the final amount that actually needs to move.
            </Text>
          </View>
        </View>

        <View style={styles.netSettlementSummary}>
          <Pressable
            style={[styles.netSettlementMetric, styles.payableMetric]}
            onPress={() => setNetSettlementInfoDialog("payable")}
          >
            <Text style={styles.netMetricLabel}>Payable</Text>
            <AmountText
              amount={netSettlementOutgoingTotal}
              size="md"
              tone={netSettlementOutgoingTotal > 0 ? "danger" : "success"}
            />
            <Text style={styles.netMetricHelper}>You pay after offsets</Text>
          </Pressable>

          <Pressable
            style={[styles.netSettlementMetric, styles.receivableMetric]}
            onPress={() => setNetSettlementInfoDialog("receivable")}
          >
            <Text style={styles.netMetricLabel}>Receivable</Text>
            <AmountText
              amount={netSettlementIncomingTotal}
              size="md"
              tone="success"
            />
            <Text style={styles.netMetricHelper}>
              You receive after offsets
            </Text>
          </Pressable>
        </View>
      </AppCard>

      <SheetModal
        visible={Boolean(memberBalanceTarget)}
        eyebrow="Member balance"
        title={
          memberBalanceTarget
            ? memberBalanceTarget.name ||
              getMemberName(getBalanceMember(memberBalanceTarget))
            : "Member details"
        }
        onClose={() => setMemberBalanceTarget(null)}
      >
        {memberBalanceTarget ? (
          <>
            {(() => {
              const balance = memberBalanceTarget;
              const member = getBalanceMember(balance);
              const assignedAmount = getBalanceAssignedAmount(balance);
              const pendingAmount = getBalancePendingAmount(balance);
              const collectedAmount = getBalanceCollectedAmount(balance);
              const itemCount = getBalanceItemCount(balance);
              const canCollect = Boolean(
                selectedRoom?.isOwner &&
                !selectedRoomClosed &&
                !balance.isMe &&
                pendingAmount > 0,
              );

              return (
                <>
                  <View style={styles.memberSheetIdentity}>
                    <Avatar
                      name={member ? getMemberName(member) : balance.name}
                      email={member?.email}
                      imageUrl={
                        member?.display_photo_url ||
                        member?.profile_photo_url ||
                        member?.photo_url
                      }
                      size={58}
                    />

                    <View style={styles.memberBalanceCopy}>
                      <Text style={styles.memberBalanceName} numberOfLines={1}>
                        {balance.name ||
                          (member ? getMemberName(member) : "Member")}
                      </Text>
                      <Text
                        style={styles.memberBalanceDetail}
                        numberOfLines={1}
                      >
                        {member?.email || balance.detail || "Room member"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.memberBalanceStatsGrid}>
                    <View style={styles.memberBalanceStat}>
                      <Text style={styles.summaryLabel}>Assigned</Text>
                      <AmountText
                        amount={assignedAmount}
                        size="sm"
                        tone="primary"
                      />
                    </View>

                    <View style={styles.memberBalanceStat}>
                      <Text style={styles.summaryLabel}>Pending</Text>
                      <AmountText
                        amount={pendingAmount}
                        size="sm"
                        tone={pendingAmount > 0 ? "danger" : "success"}
                      />
                    </View>

                    <View style={styles.memberBalanceStat}>
                      <Text style={styles.summaryLabel}>Collected</Text>
                      <AmountText
                        amount={collectedAmount}
                        size="sm"
                        tone="success"
                      />
                    </View>

                    <View style={styles.memberBalanceStat}>
                      <Text style={styles.summaryLabel}>Items</Text>
                      <Text style={styles.summaryValue}>{itemCount}</Text>
                    </View>
                  </View>

                  {canCollect ? (
                    <AppButton
                      title={
                        collectingMemberId === balance.memberId
                          ? "Collecting"
                          : "Manual collect"
                      }
                      loading={collectingMemberId === balance.memberId}
                      onPress={() => requestCollectMemberDues(balance)}
                    />
                  ) : null}

                  {canCollect ? (
                    <AppButton
                      title={
                        remindingRoomId === selectedRoom?.id
                          ? "Sending reminder"
                          : "Send reminder"
                      }
                      variant="secondary"
                      loading={remindingRoomId === selectedRoom?.id}
                      onPress={requestSendRoomReminder}
                    />
                  ) : null}

                  {member && canRemoveMember(member) ? (
                    <AppButton
                      title={
                        removingMemberId === member.id
                          ? "Removing"
                          : "Remove member"
                      }
                      variant="secondary"
                      loading={removingMemberId === member.id}
                      onPress={() => requestRemoveMember(member)}
                    />
                  ) : null}

                  {!canCollect && !(member && canRemoveMember(member)) ? (
                    <Text style={styles.memberNoActionText}>
                      {balance.isMe
                        ? "This is your own room activity."
                        : selectedRoomClosed
                          ? "Room is closed."
                          : pendingAmount > 0
                            ? "Only the host can manage this due."
                            : "No pending action."}
                    </Text>
                  ) : null}
                </>
              );
            })()}
          </>
        ) : null}
      </SheetModal>

      <SheetModal
        visible={Boolean(netSettlementInfoDialog)}
        title={
          netSettlementInfoDialog === "payable"
            ? "Payable details"
            : "Receivable details"
        }
        size="large"
        onClose={() => setNetSettlementInfoDialog(null)}
      >
        <View style={styles.netInfoSummary}>
          <View style={styles.netInfoBox}>
            <Text style={styles.summaryLabel}>Final amount</Text>
            <AmountText
              amount={visibleNetSettlementTotal}
              size="sm"
              tone={
                netSettlementInfoDialog === "payable" ? "danger" : "success"
              }
            />
            <Text style={styles.netInfoSmall}>After opposite dues adjust</Text>
          </View>

          <View style={styles.netInfoBox}>
            <Text style={styles.summaryLabel}>Direction</Text>
            <Text style={styles.summaryValue}>
              {netSettlementInfoDialog === "payable"
                ? "You pay"
                : "You receive"}
            </Text>
            <Text style={styles.netInfoSmall}>Across split rooms</Text>
          </View>

          <View style={styles.netInfoBox}>
            <Text style={styles.summaryLabel}>People</Text>
            <Text style={styles.summaryValue}>
              {visibleNetSettlements.length}
            </Text>
            <Text style={styles.netInfoSmall}>Adjusted settlements</Text>
          </View>
        </View>

        {visibleNetSettlements.length === 0 ? (
          <EmptyState
            title={`No ${netSettlementInfoDialog} settlements`}
            message="Adjusted settlement details will appear after room dues exist."
          />
        ) : (
          <View style={styles.netSettlementList}>
            {visibleNetSettlements.map((settlement) => {
              const counterparty = getSettlementCounterparty(settlement);

              const settlementTitle = settlement.isOutgoing
                ? `You pay ${settlement.toName || settlement.toEmail}`
                : `${settlement.fromName || settlement.fromEmail} pays you`;

              return (
                <View
                  style={styles.netSettlementRow}
                  key={`${settlement.fromUserId}-${settlement.toUserId}`}
                >
                  <View style={styles.netSettlementRowMain}>
                    <Text
                      style={[
                        styles.netDirectionPill,
                        settlement.isOutgoing
                          ? styles.netDirectionPayable
                          : styles.netDirectionReceivable,
                      ]}
                    >
                      {settlement.isOutgoing ? "Payable" : "Receivable"}
                    </Text>

                    <Text style={styles.netSettlementTitle} numberOfLines={1}>
                      {settlementTitle}
                    </Text>

                    <Text style={styles.netSettlementSubtext}>
                      {settlement.breakdown.length} room item
                      {settlement.breakdown.length === 1 ? "" : "s"} adjusted
                      with {counterparty}
                    </Text>

                    <View style={styles.netBreakdownList}>
                      {settlement.breakdown.slice(0, 4).map((line) => (
                        <View
                          style={styles.netBreakdownRow}
                          key={`${line.itemId}-${line.direction}`}
                        >
                          <Text
                            style={styles.netBreakdownTitle}
                            numberOfLines={1}
                          >
                            {line.roomName} · {line.title}
                          </Text>
                          <AmountText
                            amount={line.amount}
                            size="sm"
                            tone={settlement.isOutgoing ? "danger" : "success"}
                          />
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.netSettlementAmountPanel}>
                    <Text style={styles.summaryLabel}>Final amount</Text>
                    <AmountText
                      amount={settlement.amount}
                      size="sm"
                      tone={settlement.isOutgoing ? "danger" : "success"}
                    />

                    {settlement.isOutgoing ? (
                      <AppButton
                        title={
                          payingNetSettlementUserId === settlement.toUserId
                            ? "Paying"
                            : "Pay net"
                        }
                        loading={
                          payingNetSettlementUserId === settlement.toUserId
                        }
                        onPress={() => openNetSettlementPinDialog(settlement)}
                        style={styles.payNetButton}
                      />
                    ) : (
                      <Text style={styles.receivablePill}>Receivable</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </SheetModal>

      <SheetModal
        visible={roomActionsOpen}
        eyebrow="Room controls"
        title={selectedRoom ? selectedRoom.name : "Room actions"}
        onClose={() => setRoomActionsOpen(false)}
      >
        {!selectedRoom ? (
          <EmptyState title="No room selected" />
        ) : !selectedRoom.isOwner ? (
          <EmptyState
            title="Only host can manage"
            message="Only the room owner can delete, finalize, or archive this room."
          />
        ) : (
          <>
            <View style={styles.roomActionInfo}>
              <Text style={styles.cardEyebrow}>Current status</Text>
              <Text style={styles.cardTitleSmall}>
                {selectedRoom.status || "active"}
              </Text>
              <Text style={styles.cardText}>
                Outstanding amount must be settled before deleting or finalizing
                a room.
              </Text>
            </View>

            <View style={styles.roomActionInfo}>
              <Text style={styles.summaryLabel}>Outstanding</Text>
              <AmountText
                amount={selectedRoom.outstandingAmount ?? 0}
                size="sm"
                tone={
                  (selectedRoom.outstandingAmount ?? 0) > 0
                    ? "danger"
                    : "success"
                }
              />
            </View>

            <AppButton
              title={
                finalizingRoomId === selectedRoom.id
                  ? "Finalizing"
                  : "Finalize room"
              }
              loading={finalizingRoomId === selectedRoom.id}
              onPress={requestFinalizeRoom}
            />

            <AppButton
              title={
                archivingRoomId === selectedRoom.id
                  ? "Archiving"
                  : "Archive room"
              }
              variant="secondary"
              loading={archivingRoomId === selectedRoom.id}
              onPress={requestArchiveRoom}
            />

            <AppButton
              title={
                deletingRoomId === selectedRoom.id ? "Deleting" : "Delete room"
              }
              variant="secondary"
              loading={deletingRoomId === selectedRoom.id}
              onPress={requestDeleteRoom}
            />
          </>
        )}
      </SheetModal>

      <SheetModal
        visible={Boolean(netSettlementTarget)}
        eyebrow="Adjusted wallet payment"
        title="Pay final net amount"
        onClose={closeNetSettlementPinDialog}
        closeTitle="Cancel"
      >
        {netSettlementTarget ? (
          <View style={styles.pinSummaryCard}>
            <Text style={styles.cardEyebrow}>You are paying</Text>
            <Text style={styles.cardTitleSmall}>
              {netSettlementTarget.toName || netSettlementTarget.toEmail}
            </Text>

            <AmountText
              amount={netSettlementTarget.amount}
              size="lg"
              tone="danger"
            />

            <Text style={styles.netExplanationText}>
              This amount is the final balance after SplitVerse adjusts
              opposite dues across shared rooms.
            </Text>
          </View>
        ) : null}

        <AppTextInput
          label="Wallet PIN"
          value={walletPin}
          onChangeText={setWalletPin}
          placeholder="Enter wallet PIN"
          keyboardType="number-pad"
          secureTextEntry
          editable={!payingNetSettlementUserId}
        />

        <AppButton
          title={
            payingNetSettlementUserId
              ? "Paying final amount"
              : "Confirm payment"
          }
          loading={Boolean(payingNetSettlementUserId)}
          onPress={handleConfirmNetSettlementPayment}
        />
      </SheetModal>

      <SheetModal
        visible={friendModalOpen}
        title="Choose friends"
        onClose={() => setFriendModalOpen(false)}
        closeTitle="Done"
      >
        <AppTextInput
          label="Search friends"
          value={friendSearch}
          onChangeText={setFriendSearch}
          autoCapitalize="none"
          placeholder="Search by name or email"
        />

        {friends.length === 0 ? (
          <EmptyState
            title="No friends yet"
            message="Add friends from Profile before creating a room."
          />
        ) : filteredFriends.length === 0 ? (
          <EmptyState title="No matching friends" />
        ) : (
          <View style={styles.optionList}>
            {filteredFriends.map((friend) => {
              const selected = selectedFriendEmails.includes(friend.email);

              return (
                <Pressable
                  key={friend.id}
                  style={[
                    styles.friendOption,
                    selected && styles.selectedOption,
                  ]}
                  onPress={() => toggleSelectedFriend(friend.email)}
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

                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle} numberOfLines={1}>
                      {getFriendName(friend)}
                    </Text>
                    <Text style={styles.optionSubtext} numberOfLines={1}>
                      {friend.email}
                    </Text>
                  </View>

                  <Text style={styles.checkText}>
                    {selected ? "Selected" : "Select"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </SheetModal>

      <SheetModal
        visible={assignMemberModalOpen}
        title="Assign item to"
        onClose={() => setAssignMemberModalOpen(false)}
      >
        <View style={styles.optionList}>
          {sortedMembers.map((member) => {
            const selected = member.id === assignedMemberId;

            return (
              <Pressable
                key={member.id}
                style={[
                  styles.friendOption,
                  selected && styles.selectedOption,
                ]}
                onPress={() => {
                  setAssignedMemberId(member.id);
                  setAssignMemberModalOpen(false);
                }}
              >
                <Avatar
                  name={getMemberName(member)}
                  email={member.email}
                  imageUrl={
                    member.display_photo_url ||
                    member.profile_photo_url ||
                    member.photo_url
                  }
                  size={42}
                />

                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>
                    {getMemberName(member)}
                  </Text>
                  <Text style={styles.optionSubtext}>{member.email}</Text>
                </View>

                <Text style={styles.checkText}>
                  {selected ? "Selected" : "Choose"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SheetModal>

      <SheetModal
        visible={categoryModalOpen}
        title="Choose category"
        onClose={() => setCategoryModalOpen(false)}
      >
        <View style={styles.categoryGrid}>
          {categoryOptions.map((category) => {
            const selected = category.value === roomCategory;

            return (
              <Pressable
                key={category.value}
                style={[
                  styles.categoryOption,
                  selected && styles.selectedOption,
                ]}
                onPress={() => {
                  setRoomCategory(category.value);
                  setCategoryModalOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selected && styles.selectedCategoryText,
                  ]}
                >
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SheetModal>

      <SheetModal
        visible={paidByModalOpen}
        title="Who paid?"
        onClose={() => setPaidByModalOpen(false)}
      >
        <View style={styles.optionList}>
          {paidByOptions.map((option) => {
            const selected = option.email === roomPaidByEmail;

            return (
              <Pressable
                key={option.email}
                style={[
                  styles.paidByOption,
                  selected && styles.selectedOption,
                ]}
                onPress={() => {
                  setRoomPaidByEmail(option.email);
                  setPaidByModalOpen(false);
                }}
              >
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{option.name}</Text>
                  <Text style={styles.optionSubtext}>{option.email}</Text>
                </View>

                <Text style={styles.checkText}>
                  {selected ? "Selected" : "Choose"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SheetModal>

      <SheetModal
        visible={editItemModalOpen}
        title="Edit item"
        onClose={() => {
          setEditItemModalOpen(false);
          setEditingItemId("");
          setEditItemTitle("");
          setEditItemAmount("");
        }}
        closeTitle="Cancel"
      >
        <AppTextInput
          label="Item"
          value={editItemTitle}
          onChangeText={setEditItemTitle}
          placeholder="Item name"
          editable={!updatingItemId}
        />

        <AppTextInput
          label="Amount"
          value={editItemAmount}
          onChangeText={setEditItemAmount}
          placeholder={formatMoney(420)}
          keyboardType="decimal-pad"
          editable={!updatingItemId}
        />

        <AppButton
          title={updatingItemId ? "Saving item" : "Save changes"}
          loading={Boolean(updatingItemId)}
          onPress={handleSaveEditedItem}
        />
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.base,
    backgroundColor: colors.surfaceSoft,
  },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.lg,
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
    ...typography.bodySm,
  },
  createCard: {
    gap: spacing.base,
  },
  roomsCard: {
    gap: spacing.base,
  },
  addItemCard: {
    gap: spacing.base,
  },
  detailsCard: {
    gap: spacing.base,
  },
  historyCard: {
    gap: spacing.base,
  },
  cardHeadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
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
  cardTitleSmall: {
    color: colors.ink,
    ...typography.titleSm,
  },
  selector: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.base,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  selectorCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  selectorLabel: {
    color: colors.body,
    ...typography.caption,
  },
  selectorValue: {
    color: colors.ink,
    ...typography.bodySm,
  },
  selectorAction: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
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
  roomList: {
    gap: spacing.sm,
  },
  roomRow: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  activeRoomRow: {
    borderColor: colors.primary,
    backgroundColor: colors.canvas,
  },
  roomMain: {
    gap: 2,
  },
  roomName: {
    color: colors.ink,
    ...typography.titleSm,
  },
  roomMeta: {
    color: colors.body,
    ...typography.bodySm,
  },
  roomAmountBox: {
    alignSelf: "flex-start",
    gap: 2,
  },
  roomDueText: {
    color: colors.body,
    ...typography.caption,
  },
  statusPill: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.body,
    ...typography.caption,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryBox: {
    width: "48%",
    minHeight: 82,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  summaryLabel: {
    color: colors.body,
    ...typography.caption,
  },
  summaryValue: {
    color: colors.ink,
    ...typography.bodySm,
  },
  membersSection: {
    gap: spacing.base,
  },
  memberList: {
    gap: spacing.sm,
  },
  memberRow: {
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
  memberCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  memberName: {
    color: colors.ink,
    ...typography.titleSm,
  },
  memberEmail: {
    color: colors.body,
    ...typography.bodySm,
  },
  memberRole: {
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.primary,
    ...typography.caption,
  },
  itemList: {
    gap: spacing.sm,
  },
  itemRow: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    color: colors.ink,
    ...typography.titleSm,
  },
  itemSubtext: {
    marginTop: 2,
    color: colors.body,
    ...typography.bodySm,
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  itemStatus: {
    overflow: "hidden",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...typography.caption,
  },
  itemCollected: {
    color: colors.success,
    backgroundColor: colors.surfaceStrong,
  },
  itemPending: {
    color: colors.danger,
    backgroundColor: colors.surfaceStrong,
  },
  itemActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  itemActionButton: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.sm,
  },
  deleteActionButton: {
    backgroundColor: colors.surfaceStrong,
  },
  itemActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  deleteActionText: {
    color: colors.danger,
  },
  lockedText: {
    color: colors.body,
    ...typography.caption,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 11, 13, 0.45)",
  },
  sheet: {
    maxHeight: "86%",
    gap: spacing.base,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.canvas,
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  sheetTitle: {
    color: colors.ink,
    ...typography.titleMd,
  },
  optionList: {
    gap: spacing.sm,
  },
  friendOption: {
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
  paidByOption: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.canvas,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionTitle: {
    color: colors.ink,
    ...typography.titleSm,
  },
  optionSubtext: {
    color: colors.body,
    ...typography.bodySm,
  },
  checkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryOption: {
    minHeight: 44,
    minWidth: "30%",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.sm,
  },
  categoryText: {
    color: colors.body,
    ...typography.caption,
  },
  selectedCategoryText: {
    color: colors.primary,
  },

  netSettlementCard: {
    gap: spacing.base,
  },
  netSettlementHeadCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  netSettlementNote: {
    color: colors.body,
    ...typography.bodySm,
  },
  netSettlementSummary: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  netSettlementMetric: {
    flex: 1,
    minHeight: 118,
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.sm,
  },
  payableMetric: {
    borderColor: colors.hairlineSoft,
    backgroundColor: colors.surfaceSoft,
  },
  receivableMetric: {
    borderColor: colors.hairlineSoft,
    backgroundColor: colors.surfaceSoft,
  },
  netMetricLabel: {
    color: colors.body,
    ...typography.caption,
  },
  netMetricHelper: {
    color: colors.body,
    ...typography.caption,
  },
  sheetEyebrow: {
    color: colors.body,
    ...typography.caption,
  },
  netInfoSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  netInfoBox: {
    flexGrow: 1,
    minWidth: "30%",
    minHeight: 82,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  netInfoSmall: {
    color: colors.body,
    fontSize: 11,
    lineHeight: 15,
  },
  netExplanationBox: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  netExplanationTitle: {
    color: colors.ink,
    ...typography.titleSm,
  },
  netExplanationText: {
    color: colors.body,
    ...typography.bodySm,
  },
  netSettlementList: {
    gap: spacing.sm,
  },
  netSettlementRow: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  netSettlementRowMain: {
    gap: spacing.xs,
  },
  netDirectionPill: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...typography.caption,
  },
  netDirectionPayable: {
    color: colors.danger,
    backgroundColor: colors.surfaceStrong,
  },
  netDirectionReceivable: {
    color: colors.success,
    backgroundColor: colors.surfaceStrong,
  },
  netSettlementTitle: {
    color: colors.ink,
    ...typography.titleSm,
  },
  netSettlementSubtext: {
    color: colors.body,
    ...typography.bodySm,
  },
  netBreakdownList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  netBreakdownRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  netBreakdownTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.body,
    ...typography.bodySm,
  },
  netSettlementAmountPanel: {
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.canvas,
    padding: spacing.sm,
  },
  payNetButton: {
    minHeight: 40,
  },
  receivablePill: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.success,
    ...typography.caption,
  },
  pinSummaryCard: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.base,
  },

  memberBalanceCard: {
    gap: spacing.base,
  },
  pendingDuesCard: {
    gap: spacing.base,
  },
  reminderButton: {
    minHeight: 38,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.base,
  },
  reminderButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  memberBalanceList: {
    gap: spacing.sm,
  },
  memberBalanceRow: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  memberBalanceRowPending: {
    borderColor: colors.hairline,
  },
  memberBalanceRowExpanded: {
    backgroundColor: colors.canvas,
    borderColor: colors.primary,
  },
  memberBalanceTop: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  memberBalanceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  memberBalanceName: {
    color: colors.ink,
    ...typography.titleSm,
  },
  memberBalanceDetail: {
    color: colors.body,
    ...typography.bodySm,
  },
  memberBalanceAmountBox: {
    alignItems: "flex-end",
    gap: 2,
  },
  memberBalanceAmountLabel: {
    color: colors.body,
    ...typography.caption,
  },
  memberBalanceExpanded: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    paddingTop: spacing.sm,
  },
  memberBalanceStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  memberBalanceStat: {
    width: "48%",
    minHeight: 74,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  memberBalanceActions: {
    gap: spacing.sm,
  },
  memberActionButton: {
    minHeight: 42,
  },
  memberNoActionText: {
    color: colors.body,
    ...typography.bodySm,
  },
  myDueList: {
    gap: spacing.sm,
  },
  myDueRow: {
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

  memberSheetIdentity: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  cardText: {
    color: colors.body,
    ...typography.bodySm,
  },
  roomActionsButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.base,
  },
  roomActionsButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  roomActionInfo: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.base,
  },
});
