import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import {
  addSplitRoomMembers,
  archiveSplitRoom,
  createSplitRoom,
  createSplitRoomItem,
  deleteSplitRoom,
  deleteSplitRoomItem,
  getFriendsSummary,
  getNetSettlements,
  getPendingDues,
  getSplitRooms,
  finalizeSplitRoom,
  payNetSettlement,
  paySplitRoomDue,
  updateSplitRoomItem,
  type Friend,
  type NetSettlement,
  type PendingDue,
  type SplitRoom,
} from "../lib/api";

import { useAppSettings } from "../context/useAppSettings";
import { useAuth } from "../context/useAuth";
import Dropdown, { type DropdownOption } from "../components/Dropdown";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { withTopProgress } from "../utils/topProgress";
import DashboardLayout from "./dashboard/DashboardLayout";
import "../styles/SharedSplitRooms.css";

function getMemberName(member: SplitRoom["members"][number]) {
  if (member.isMe) {
    return "Me";
  }

  return member.display_name || member.email || "Member";
}

function getPersonInitials(name?: string | null, email?: string | null) {
  const source = name || email?.split("@")[0] || "SV";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "S";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || "V";

  return `${first}${second}`.toUpperCase();
}

function getDisplayAvatarUrl(person: {
  photo_url?: string | null;
  profile_photo_url?: string | null;
  avatar_mode?: string | null;
  display_photo_url?: string | null;
}) {
  if (person.avatar_mode === "initials") {
    return "";
  }

  return person.display_photo_url || person.profile_photo_url || person.photo_url || "";
}

function renderFriendMiniAvatar(friend: Friend) {
  const avatarUrl = getDisplayAvatarUrl(friend);

  if (avatarUrl) {
    return <img src={avatarUrl} alt="" />;
  }

  return <span>{getPersonInitials(friend.name, friend.email)}</span>;
}

function renderMemberMiniAvatar(member?: SplitRoom["members"][number]) {
  if (!member) {
    return <span className="room-member-avatar initials">SV</span>;
  }

  const avatarUrl = getDisplayAvatarUrl(member);

  if (avatarUrl) {
    return <img className="room-member-avatar" src={avatarUrl} alt="" />;
  }

  return (
    <span className="room-member-avatar initials">
      {getPersonInitials(member.display_name, member.email)}
    </span>
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

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function getIndiaRoomName(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${value("day")}/${value("month")}/${value("year")}`;
}

export default function SharedSplitRooms() {
  const {
    appCurrency,
    convertCurrency,
    currencies,
    formatCurrency,
  } = useAppSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomIdFromNotification = searchParams.get("roomId") || "";
  const [rooms, setRooms] = useState<SplitRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [assignmentFriendPickerMode, setAssignmentFriendPickerMode] = useState<
    "assign" | "automatic" | null
  >(null);
  const [pickerSelectedValues, setPickerSelectedValues] = useState<string[]>([]);
  const [savingPickerSelection, setSavingPickerSelection] = useState(false);
  const [roomCategory, setRoomCategory] = useState("restaurant");
  const [itemTitle, setItemTitle] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [assignedMemberId, setAssignedMemberId] = useState("");
  const [itemPaidByMemberId, setItemPaidByMemberId] = useState("");
  const [splitMode, setSplitMode] = useState<"manual" | "automatic">("manual");
  const [automaticMemberIds, setAutomaticMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRoom, setSavingRoom] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState("");
  const [editItemTitle, setEditItemTitle] = useState("");
  const [editItemAmount, setEditItemAmount] = useState("");
  const [updatingItemId, setUpdatingItemId] = useState("");
  const [deletingItemId, setDeletingItemId] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState("");
  const [finalizingRoomId, setFinalizingRoomId] = useState("");
  const [archivingRoomId, setArchivingRoomId] = useState("");
  const [pendingDues, setPendingDues] = useState<PendingDue[]>([]);
  const [netSettlements, setNetSettlements] = useState<NetSettlement[]>([]);
  const [netSettlementPinDialogOpen, setNetSettlementPinDialogOpen] = useState(false);
  const [netSettlementTargetUserId, setNetSettlementTargetUserId] = useState("");
  const [netSettlementWalletPin, setNetSettlementWalletPin] = useState("");
  const [netSettlementDialogError, setNetSettlementDialogError] = useState("");
  const [payingNetSettlementUserId, setPayingNetSettlementUserId] = useState("");
  const [netSettlementInfoDialog, setNetSettlementInfoDialog] = useState<
    "payable" | "receivable" | null
  >(null);
  const [payingDueId, setPayingDueId] = useState("");
  const [paymentDueId, setPaymentDueId] = useState("");
  const [paymentWalletPin, setPaymentWalletPin] = useState("");
  const [paymentPinDialogOpen, setPaymentPinDialogOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"single" | "all">("single");
  const [paymentDialogError, setPaymentDialogError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const optimisticIdRef = useRef(0);
  const activeCurrency =
    currencies.find((currency) => currency.code === appCurrency) ?? currencies[0];
  function convertSelectedCurrencyInputToInr(amount: number) {
    return roundMoney(convertCurrency(amount, appCurrency, "INR"));
  }

  function convertInrToSelectedCurrencyInput(amountInInr: number) {
    return roundMoney(convertCurrency(amountInInr, "INR", appCurrency));
  }

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? rooms[0],
    [rooms, selectedRoomId],
  );
  const roomOptions = useMemo<DropdownOption[]>(
    () =>
      rooms.length > 0
        ? rooms.map((room) => ({ value: room.id, label: room.name }))
        : [{ value: "", label: "No rooms yet" }],
    [rooms],
  );

  const sortedMembers = useMemo(() => {
    if (!selectedRoom) {
      return [];
    }

    return [...selectedRoom.members].sort((left, right) => {
      if (left.isMe) {
        return -1;
      }

      if (right.isMe) {
        return 1;
      }

      return getMemberName(left).localeCompare(getMemberName(right));
    });
  }, [selectedRoom]);
  const memberOptions = useMemo<DropdownOption[]>(
    () =>
      sortedMembers.map((member) => ({
        value: member.id,
        label: member.isMe ? "Me" : getMemberName(member),
      })),
    [sortedMembers],
  );
  const assignedMemberLabel = useMemo(
    () =>
      sortedMembers.find((member) => member.id === assignedMemberId)
        ? getMemberName(
            sortedMembers.find((member) => member.id === assignedMemberId)!,
          )
        : "Choose friend",
    [assignedMemberId, sortedMembers],
  );
  const automaticMembersLabel = useMemo(() => {
    const selectedNames = sortedMembers
      .filter((member) => automaticMemberIds.includes(member.id))
      .map(getMemberName);

    if (selectedNames.length === 0) return "Choose friends";
    if (selectedNames.length <= 2) return selectedNames.join(", ");
    return `${selectedNames.length} people selected`;
  }, [automaticMemberIds, sortedMembers]);
  const selectedRoomClosed = Boolean(selectedRoom?.isArchived || selectedRoom?.isFinalized);
  const paymentDue = useMemo(
    () => pendingDues.find((due) => due.id === paymentDueId) ?? null,
    [paymentDueId, pendingDues],
  );

  const outgoingNetSettlements = useMemo(
    () => netSettlements.filter((settlement) => settlement.isOutgoing),
    [netSettlements],
  );
  const incomingNetSettlements = useMemo(
    () => netSettlements.filter((settlement) => settlement.isIncoming),
    [netSettlements],
  );
  const netSettlementTarget = useMemo(
    () =>
      netSettlements.find(
        (settlement) =>
          settlement.isOutgoing && settlement.toUserId === netSettlementTargetUserId,
      ) ?? null,
    [netSettlementTargetUserId, netSettlements],
  );
  const netSettlementOutgoingTotal = useMemo(
    () =>
      outgoingNetSettlements.reduce(
        (sum, settlement) => sum + Number(settlement.amount || 0),
        0,
      ),
    [outgoingNetSettlements],
  );
  const netSettlementIncomingTotal = useMemo(
    () =>
      incomingNetSettlements.reduce(
        (sum, settlement) => sum + Number(settlement.amount || 0),
        0,
      ),
    [incomingNetSettlements],
  );
  const automaticSharePreview = useMemo(() => {
    const selectedAmount = Number(itemAmount);

    if (
      !Number.isFinite(selectedAmount) ||
      selectedAmount <= 0 ||
      automaticMemberIds.length === 0
    ) {
      return [];
    }

    const totalCents = Math.round(selectedAmount * 100);
    const baseCents = Math.floor(totalCents / automaticMemberIds.length);
    const remainder = totalCents - baseCents * automaticMemberIds.length;

    return automaticMemberIds.map((memberId, index) => ({
      memberId,
      name: getMemberName(
        sortedMembers.find((member) => member.id === memberId)!,
      ),
      amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
    }));
  }, [automaticMemberIds, itemAmount, sortedMembers]);
  const visibleNetSettlements = useMemo(
    () =>
      netSettlementInfoDialog === "payable"
        ? outgoingNetSettlements
        : netSettlementInfoDialog === "receivable"
          ? incomingNetSettlements
          : [],
    [incomingNetSettlements, netSettlementInfoDialog, outgoingNetSettlements],
  );
  const visibleNetSettlementTotal =
    netSettlementInfoDialog === "payable"
      ? netSettlementOutgoingTotal
      : netSettlementInfoDialog === "receivable"
        ? netSettlementIncomingTotal
        : 0;
  const paymentRoom = useMemo(
    () =>
      paymentDue
        ? rooms.find((room) => room.id === paymentDue.roomId) ?? selectedRoom
        : selectedRoom,
    [paymentDue, rooms, selectedRoom],
  );
  const paymentPayerMember = useMemo(
    () => paymentRoom?.members.find((member) => member.isMe) ?? null,
    [paymentRoom],
  );
  const paymentReceiverMember = useMemo(
    () => paymentRoom?.members.find((member) => member.isOwner) ?? null,
    [paymentRoom],
  );
  const paymentEntitledItems = useMemo(() => {
    if (!paymentRoom || !paymentPayerMember) {
      return [];
    }

    return paymentRoom.items.filter(
      (item) => item.assigned_member_id === paymentPayerMember.id,
    );
  }, [paymentPayerMember, paymentRoom]);
  const paymentPendingItems = useMemo(
    () => paymentEntitledItems.filter((item) => !item.isCollected),
    [paymentEntitledItems],
  );
  const paymentRoomPendingDues = useMemo(
    () =>
      paymentRoom
        ? pendingDues.filter((due) => due.roomId === paymentRoom.id)
        : [],
    [paymentRoom, pendingDues],
  );
  const paymentPendingDueByItemId = useMemo(
    () => new Map(paymentRoomPendingDues.map((due) => [due.id, due])),
    [paymentRoomPendingDues],
  );
  const paymentTargetDues = useMemo(
    () =>
      paymentMode === "all"
        ? paymentRoomPendingDues
        : paymentDue
          ? [paymentDue]
          : [],
    [paymentDue, paymentMode, paymentRoomPendingDues],
  );
  const paymentTargetAmount = useMemo(
    () =>
      paymentTargetDues.reduce((sum, due) => sum + Number(due.amount || 0), 0),
    [paymentTargetDues],
  );
  const paymentMemberTotal = useMemo(
    () =>
      paymentEntitledItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [paymentEntitledItems],
  );
  const trimmedFriendSearch = friendSearch.trim();
  const filteredFriends = useMemo(() => {
    const normalizedSearch = trimmedFriendSearch.toLowerCase();

    if (!normalizedSearch) {
      return friends;
    }

    return friends.filter((friend) =>
      `${friend.name ?? ""} ${friend.email}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [friends, trimmedFriendSearch]);
  const itemPlaceholder = getItemPlaceholder(selectedRoom?.category);
  const selectedRoomItems = useMemo(
    () => selectedRoom?.items ?? [],
    [selectedRoom],
  );


  const reloadSplitRoomData = async (preferredRoomId?: string) => {
    const [roomData, duesData, netData] = await Promise.all([
      getSplitRooms(),
      getPendingDues(),
      getNetSettlements(),
    ]);

    setRooms(roomData.rooms);

    const nextRoomId =
      preferredRoomId ||
      roomIdFromNotification ||
      selectedRoomId ||
      roomData.rooms[0]?.id ||
      "";

    setSelectedRoomId(
      roomData.rooms.some((room) => room.id === nextRoomId)
        ? nextRoomId
        : roomData.rooms[0]?.id || "",
    );
    setPendingDues(duesData.dues);
    setNetSettlements(netData.settlements);
  };

  function emitSplitVerseUpdates({ pendingDuesChanged = true } = {}) {
    window.dispatchEvent(
      new CustomEvent("splitverse:data-updated", {
        detail: { source: "split-rooms" },
      }),
    );

    if (pendingDuesChanged) {
      window.dispatchEvent(new Event("splitverse:pending-dues-updated"));
    }
  }

  function refreshSplitRoomDataInBackground(
    preferredRoomId?: string,
    { pendingDuesChanged = true } = {},
  ) {
    emitSplitVerseUpdates({ pendingDuesChanged });
    void reloadSplitRoomData(preferredRoomId);
  }

  useEffect(() => {
    let active = true;

    async function loadInitialRooms() {
      try {
        setLoading(true);
        setError("");
        const [roomData, friendsData, duesData, netData] = await Promise.all([
          getSplitRooms(),
          getFriendsSummary(),
          getPendingDues(),
          getNetSettlements(),
        ]);

        if (!active) {
          return;
        }

        const nextRoomId =
          roomIdFromNotification || roomData.rooms[0]?.id || "";
        setRooms(roomData.rooms);
        setSelectedRoomId(
          roomData.rooms.some((room) => room.id === nextRoomId)
            ? nextRoomId
            : roomData.rooms[0]?.id || "",
        );
        setFriends(friendsData.friends);
        setPendingDues(duesData.dues);
        setNetSettlements(netData.settlements);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load split rooms",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitialRooms();

    return () => {
      active = false;
    };
  }, [roomIdFromNotification]);

  useEffect(() => {
    if (
      roomIdFromNotification &&
      rooms.some((room) => room.id === roomIdFromNotification)
    ) {
      const timer = window.setTimeout(() => {
        setSelectedRoomId(roomIdFromNotification);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [roomIdFromNotification, rooms]);

  useEffect(() => {
    const handleDataUpdated = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;

      if (source === "split-rooms") {
        return;
      }

      void reloadSplitRoomData(selectedRoomId);
    };

    window.addEventListener("splitverse:data-updated", handleDataUpdated);

    return () => {
      window.removeEventListener("splitverse:data-updated", handleDataUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdFromNotification, selectedRoomId]);

  useEffect(() => {
    const selfMember = sortedMembers.find((member) => member.isMe);
    const firstMember = selfMember ?? sortedMembers[0];
    const nextAssignedMemberId = firstMember?.id || "";

    if (
      (!assignedMemberId ||
        !sortedMembers.some((member) => member.id === assignedMemberId)) &&
      nextAssignedMemberId !== assignedMemberId
    ) {
      const timer = window.setTimeout(() => {
        setAssignedMemberId(nextAssignedMemberId);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [assignedMemberId, sortedMembers]);

  useEffect(() => {
    const selfMember = sortedMembers.find((member) => member.isMe);
    const fallbackMemberId = selfMember?.id || sortedMembers[0]?.id || "";
    const timer = window.setTimeout(() => {
      if (!sortedMembers.some((member) => member.id === itemPaidByMemberId)) {
        setItemPaidByMemberId(fallbackMemberId);
      }

      setAutomaticMemberIds((current) => {
        const validIds = current.filter((memberId) =>
          sortedMembers.some((member) => member.id === memberId),
        );

        return validIds.length > 0
          ? validIds
          : sortedMembers.map((member) => member.id);
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [itemPaidByMemberId, sortedMembers]);

  const selfPickerValue = "__me__";

  function memberToPickerValue(member: SplitRoom["members"][number]) {
    return member.isMe ? selfPickerValue : member.email || "";
  }

  function openAssignmentFriendPicker(mode: "assign" | "automatic") {
    if (!selectedRoom || !selectedRoom.isOwner || selectedRoomClosed) {
      return;
    }

    const selectedValues =
      mode === "assign"
        ? sortedMembers
            .filter((member) => member.id === assignedMemberId)
            .map(memberToPickerValue)
            .filter(Boolean)
        : sortedMembers
            .filter((member) => automaticMemberIds.includes(member.id))
            .map(memberToPickerValue)
            .filter(Boolean);

    setPickerSelectedValues(selectedValues);
    setFriendSearch("");
    setAssignmentFriendPickerMode(mode);
  }

  function togglePickerValue(value: string) {
    setPickerSelectedValues((current) => {
      if (assignmentFriendPickerMode === "assign") {
        return [value];
      }

      return current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
    });
  }

  async function applyAssignmentFriendSelection() {
    if (!selectedRoom || !assignmentFriendPickerMode) {
      return;
    }

    if (pickerSelectedValues.length === 0) {
      setError(
        assignmentFriendPickerMode === "assign"
          ? "Choose one person to assign this item to."
          : "Choose at least one person for the automatic split.",
      );
      return;
    }

    const friendEmails = pickerSelectedValues.filter(
      (value) => value !== selfPickerValue,
    );
    const existingEmails = new Set(
      selectedRoom.members
        .map((member) => member.email?.toLowerCase())
        .filter((email): email is string => Boolean(email)),
    );
    const emailsToAdd = friendEmails.filter(
      (email) => !existingEmails.has(email.toLowerCase()),
    );

    try {
      setSavingPickerSelection(true);
      setError("");
      setMessage("");

      await withTopProgress(async () => {
        if (emailsToAdd.length > 0) {
          await addSplitRoomMembers(selectedRoom.id, emailsToAdd);
        }

        const roomData = await getSplitRooms();
        const updatedRoom = roomData.rooms.find((room) => room.id === selectedRoom.id);

        if (!updatedRoom) {
          throw new Error("Could not reload the selected room.");
        }

        setRooms(roomData.rooms);
        setSelectedRoomId(updatedRoom.id);

        const memberIds = pickerSelectedValues
          .map((value) => {
            if (value === selfPickerValue) {
              return updatedRoom.members.find((member) => member.isMe)?.id || "";
            }

            return (
              updatedRoom.members.find(
                (member) => member.email?.toLowerCase() === value.toLowerCase(),
              )?.id || ""
            );
          })
          .filter(Boolean);

        if (assignmentFriendPickerMode === "assign") {
          setAssignedMemberId(memberIds[0] || "");
          setMessage("Assigned person updated.");
        } else {
          setAutomaticMemberIds(memberIds);
          setMessage("Split members updated.");
        }

        emitSplitVerseUpdates({ pendingDuesChanged: false });
      });

      setAssignmentFriendPickerMode(null);
      setFriendSearch("");
    } catch (pickerError) {
      setError(
        pickerError instanceof Error
          ? pickerError.message
          : "Could not update room members.",
      );
    } finally {
      setSavingPickerSelection(false);
    }
  }

  function getOptimisticId(prefix: string) {
    optimisticIdRef.current += 1;
    return `optimistic-${prefix}-${Date.now()}-${optimisticIdRef.current}`;
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
    const optimisticItem = {
      id: getOptimisticId("item"),
      room_id: room.id,
      assigned_member_id: assignedMemberId,
      title,
      amount,
      collected_at: null,
      expense_id: null,
      isCollected: false,
      created_at: new Date().toISOString(),
    };
    const updatedBalances = room.balances.map((balance) => {
      if (balance.memberId !== assignedMemberId) {
        return balance;
      }

      const nextAmount = balance.amount + amount;
      const nextOutstandingAmount = assignedMember?.isMe
        ? balance.outstandingAmount
        : balance.outstandingAmount + amount;

      return {
        ...balance,
        detail: assignedMember?.isMe
          ? "Your spend"
          : nextOutstandingAmount > 0
            ? "Dues pending"
            : balance.detail,
        amount: nextAmount,
        outstandingAmount: nextOutstandingAmount,
        isCollected:
          !assignedMember?.isMe && nextAmount > 0 ? false : balance.isCollected,
        itemCount: balance.itemCount + 1,
      };
    });
    const outstandingAmount = updatedBalances.reduce(
      (sum, balance) => sum + (balance.isMe ? 0 : balance.outstandingAmount),
      0,
    );

    return {
      ...room,
      items: [optimisticItem, ...room.items],
      totalAmount: room.totalAmount + amount,
      outstandingAmount,
      balances: updatedBalances,
      status: room.status === "New" ? "No one paid" : room.status,
    };
  }

  function createOptimisticRoom({
    name,
    category,
    friendEmails,
    paidByEmail,
  }: {
    name: string;
    category: string;
    friendEmails: string[];
    paidByEmail: string;
  }): SplitRoom {
    const roomId = getOptimisticId("room");
    const createdAt = new Date().toISOString();
    const ownerMemberId = getOptimisticId("member-owner");
    const ownerMember = {
      id: ownerMemberId,
      room_id: roomId,
      user_id: null,
      display_name: "Me",
      email: null,
      role: "owner",
      status: "active",
      isMe: true,
      isOwner: true,
    };
    const friendMembers = friendEmails.map((email) => {
      const friend = friends.find((item) => item.email === email);

      return {
        id: getOptimisticId("member"),
        room_id: roomId,
        user_id: friend?.id ?? null,
        display_name: friend?.name || email.split("@")[0],
        email,
        role: "member",
        status: "active",
        isMe: false,
        isOwner: false,
      };
    });
    const members = [ownerMember, ...friendMembers];
    const paidByFriend = friends.find((friend) => friend.email === paidByEmail);

    return {
      id: roomId,
      name,
      category,
      created_at: createdAt,
      paymentStatus: "no_one_paid",
      paidByUserId: paidByFriend?.id ?? null,
      paidByName: paidByFriend?.name || (paidByEmail === user?.email ? "Me" : paidByEmail),
      paidByEmail,
      isOwner: true,
      isArchived: false,
      isFinalized: false,
      archivedAt: null,
      finalizedAt: null,
      memberCount: members.length,
      totalAmount: 0,
      outstandingAmount: 0,
      collectedAmount: 0,
      status: "Creating...",
      members,
      balances: members.map((member) => ({
        memberId: member.id,
        name: member.isMe ? "Me" : member.display_name || member.email,
        detail: member.isMe ? "Your spend" : "No dues yet",
        amount: 0,
        outstandingAmount: 0,
        collectedAmount: 0,
        isMe: member.isMe,
        isCollected: false,
        itemCount: 0,
      })),
      items: [],
    };
  }

  function updateRoomItemOptimistically(
    room: SplitRoom,
    itemId: string,
    title: string,
    amount: number,
  ): SplitRoom {
    const existingItem = room.items.find((item) => item.id === itemId);

    if (!existingItem) {
      return room;
    }

    const member = room.members.find(
      (item) => item.id === existingItem.assigned_member_id,
    );
    const amountDiff = amount - existingItem.amount;
    const affectsOutstanding = !member?.isMe && !existingItem.isCollected;
    const affectsCollected = !member?.isMe && existingItem.isCollected;

    return {
      ...room,
      totalAmount: room.totalAmount + amountDiff,
      outstandingAmount: affectsOutstanding
        ? room.outstandingAmount + amountDiff
        : room.outstandingAmount,
      collectedAmount: affectsCollected
        ? room.collectedAmount + amountDiff
        : room.collectedAmount,
      items: room.items.map((item) =>
        item.id === itemId ? { ...item, title, amount } : item,
      ),
      balances: room.balances.map((balance) =>
        balance.memberId === existingItem.assigned_member_id
          ? {
              ...balance,
              amount: balance.amount + amountDiff,
              outstandingAmount: affectsOutstanding
                ? balance.outstandingAmount + amountDiff
                : balance.outstandingAmount,
              collectedAmount: affectsCollected
                ? balance.collectedAmount + amountDiff
                : balance.collectedAmount,
            }
          : balance,
      ),
    };
  }

  function deleteRoomItemOptimistically(
    room: SplitRoom,
    itemToDelete: SplitRoom["items"][number],
  ): SplitRoom {
    const member = room.members.find(
      (item) => item.id === itemToDelete.assigned_member_id,
    );
    const affectsOutstanding = !member?.isMe && !itemToDelete.isCollected;
    const affectsCollected = !member?.isMe && itemToDelete.isCollected;
    const nextItems = room.items.filter((item) => item.id !== itemToDelete.id);
    const nextOutstandingAmount = affectsOutstanding
      ? Math.max(0, room.outstandingAmount - itemToDelete.amount)
      : room.outstandingAmount;

    return {
      ...room,
      items: nextItems,
      totalAmount: Math.max(0, room.totalAmount - itemToDelete.amount),
      outstandingAmount: nextOutstandingAmount,
      collectedAmount: affectsCollected
        ? Math.max(0, room.collectedAmount - itemToDelete.amount)
        : room.collectedAmount,
      status: nextItems.length === 0 ? "New" : room.status,
      balances: room.balances.map((balance) =>
        balance.memberId === itemToDelete.assigned_member_id
          ? {
              ...balance,
              amount: Math.max(0, balance.amount - itemToDelete.amount),
              outstandingAmount: affectsOutstanding
                ? Math.max(0, balance.outstandingAmount - itemToDelete.amount)
                : balance.outstandingAmount,
              collectedAmount: affectsCollected
                ? Math.max(0, balance.collectedAmount - itemToDelete.amount)
                : balance.collectedAmount,
              itemCount: Math.max(0, balance.itemCount - 1),
            }
          : balance,
      ),
    };
  }

  function markPendingDuePaid(dueId: string) {
    const paidDue = pendingDues.find((due) => due.id === dueId);

    setPendingDues((prev) => prev.filter((due) => due.id !== dueId));

    if (!paidDue) {
      return;
    }

    const paidAt = new Date().toISOString();

    setRooms((prev) =>
      prev.map((room) =>
        room.id === paidDue.roomId
          ? {
              ...room,
              items: room.items.map((item) =>
                item.id === dueId
                  ? {
                      ...item,
                      collected_at: item.collected_at ?? paidAt,
                      isCollected: true,
                    }
                  : item,
              ),
            }
          : room,
      ),
    );
  }

  function getRoomItemMemberName(memberId: string) {
    const member = selectedRoom?.members.find((item) => item.id === memberId);

    if (!member) {
      return "Member";
    }

    return getMemberName(member);
  }

  function startEditingItem(item: SplitRoom["items"][number]) {
    setHistoryDialogOpen(true);
    setEditingItemId(item.id);
    setEditItemTitle(item.title);
    setEditItemAmount(String(convertInrToSelectedCurrencyInput(item.amount)));
    setMessage("");
    setError("");
  }

  function cancelEditingItem() {
    setEditingItemId("");
    setEditItemTitle("");
    setEditItemAmount("");
  }

  function closeHistoryDialog() {
    setHistoryDialogOpen(false);
    cancelEditingItem();
  }

  async function handleUpdateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const title = editItemTitle.trim();
    const amountInSelectedCurrency = Number(editItemAmount);

    if (!selectedRoom) {
      setError("Choose a room first.");
      return;
    }

    if (!editingItemId) {
      setError("Choose an item to edit.");
      return;
    }

    if (!title) {
      setError("Item name is required.");
      return;
    }

    if (
      !Number.isFinite(amountInSelectedCurrency) ||
      amountInSelectedCurrency <= 0
    ) {
      setError(`Amount must be greater than 0 ${appCurrency}.`);
      return;
    }

    const amountInInr = convertSelectedCurrencyInputToInr(
      amountInSelectedCurrency,
    );

    if (!Number.isFinite(amountInInr) || amountInInr <= 0) {
      setError("Could not convert this amount to INR. Try again.");
      return;
    }

    const previousRooms = rooms;
    const previousPendingDues = pendingDues;

    try {
      setUpdatingItemId(editingItemId);

      setRooms((prev) =>
        prev.map((room) =>
          room.id === selectedRoom.id
            ? updateRoomItemOptimistically(room, editingItemId, title, amountInInr)
            : room,
        ),
      );
      setMessage("Split item updated.");
      cancelEditingItem();

      await withTopProgress(async () => {
        await updateSplitRoomItem(editingItemId, {
          title,
          amount: amountInInr,
        });
        refreshSplitRoomDataInBackground(selectedRoom.id);
      });
    } catch (updateError) {
      setRooms(previousRooms);
      setPendingDues(previousPendingDues);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update item",
      );
    } finally {
      setUpdatingItemId("");
    }
  }

  async function handleDeleteItem(item: SplitRoom["items"][number]) {
    setMessage("");
    setError("");

    if (!selectedRoom) {
      setError("Choose a room first.");
      return;
    }

    const previousRooms = rooms;
    const previousPendingDues = pendingDues;

    try {
      setDeletingItemId(item.id);

      setRooms((prev) =>
        prev.map((room) =>
          room.id === selectedRoom.id
            ? deleteRoomItemOptimistically(room, item)
            : room,
        ),
      );

      if (editingItemId === item.id) {
        cancelEditingItem();
      }

      setMessage("Split item deleted.");

      await withTopProgress(async () => {
        await deleteSplitRoomItem(item.id);
        refreshSplitRoomDataInBackground(selectedRoom.id);
      });
    } catch (deleteError) {
      setRooms(previousRooms);
      setPendingDues(previousPendingDues);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete item",
      );
    } finally {
      setDeletingItemId("");
    }
  }

  const handleCreateRoom = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const previousRooms = rooms;
    const previousSelectedRoomId = selectedRoomId;
    const nextRoomName = getIndiaRoomName();
    const nextRoomCategory = roomCategory;
    const nextPaidByEmail = user?.email || "";
    const optimisticRoom = createOptimisticRoom({
      name: nextRoomName,
      category: nextRoomCategory,
      friendEmails: [],
      paidByEmail: nextPaidByEmail,
    });

    try {
      setSavingRoom(true);
      setRooms((prev) => [optimisticRoom, ...prev]);
      setSelectedRoomId(optimisticRoom.id);
      setRoomCategory("restaurant");
      setMessage("Room created instantly. Saving...");

      await withTopProgress(async () => {
        const response = await createSplitRoom({
          members: [],
          dailyRoom: true,
        });

        setMessage("Room created and added to your active rooms.");
        void reloadSplitRoomData(response.room.id);
      });
    } catch (createError) {
      setRooms(previousRooms);
      setSelectedRoomId(previousSelectedRoomId);
      setRoomCategory(nextRoomCategory);
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create room",
      );
    } finally {
      setSavingRoom(false);
    }
  };

  const handleAddItem = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!selectedRoom) {
      setError("Create a room first.");
      return;
    }

    if (!selectedRoom.isOwner) {
      setError("Only the room owner can add items to this room.");
      return;
    }

    const amountInSelectedCurrency = Number(itemAmount);

    if (!itemTitle.trim()) {
      setError("Item name is required.");
      return;
    }

    if (
      !Number.isFinite(amountInSelectedCurrency) ||
      amountInSelectedCurrency <= 0
    ) {
      setError(`Amount must be greater than 0 ${appCurrency}.`);
      return;
    }

    const numericAmount = convertSelectedCurrencyInputToInr(
      amountInSelectedCurrency,
    );

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Could not convert this amount to INR. Try again.");
      return;
    }

    if (!itemPaidByMemberId) {
      setError("Choose who paid for this item.");
      return;
    }

    if (splitMode === "manual" && !assignedMemberId) {
      setError("Choose who this item is assigned to.");
      return;
    }

    if (splitMode === "automatic" && automaticMemberIds.length === 0) {
      setError("Select at least one member for the automatic split.");
      return;
    }

    const previousRooms = rooms;
    const previousPendingDues = pendingDues;
    const previousItemTitle = itemTitle;
    const previousItemAmount = itemAmount;
    const assignedMember = sortedMembers.find(
      (member) => member.id === assignedMemberId,
    );

    try {
      setSavingItem(true);
      if (splitMode === "manual") {
        setRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom.id
              ? addOptimisticRoomItem({
                  room,
                  title: itemTitle.trim(),
                  amount: numericAmount,
                  assignedMemberId,
                })
              : room,
          ),
        );
      }
      setItemTitle("");
      setItemAmount("");
      setMessage(
        splitMode === "automatic"
          ? "Splitting item equally..."
          : assignedMember?.isMe
            ? "Expense item added"
            : "Due added",
      );

      await withTopProgress(async () => {
        await createSplitRoomItem(selectedRoom.id, {
          title: previousItemTitle.trim(),
          amount: numericAmount,
          paidByMemberId: itemPaidByMemberId,
          splitMode,
          ...(splitMode === "automatic"
            ? { assignedMemberIds: automaticMemberIds }
            : { assignedMemberId }),
        });

        setMessage(
          splitMode === "automatic"
            ? `Item split equally between ${automaticMemberIds.length} members.`
            : assignedMember?.isMe
              ? "Expense item added"
              : "Expense item added as a due",
        );
        refreshSplitRoomDataInBackground(selectedRoom.id, {
          pendingDuesChanged:
            splitMode === "automatic" || !assignedMember?.isMe,
        });
      });
    } catch (itemError) {
      setRooms(previousRooms);
      setPendingDues(previousPendingDues);
      setItemTitle(previousItemTitle);
      setItemAmount(previousItemAmount);
      setError(
        `${
          itemError instanceof Error ? itemError.message : "Failed to add item"
        } The instant item was rolled back.`,
      );
      setMessage("");
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteRoom = async (room: SplitRoom) => {
    setMessage("");
    setError("");

    if (!room.isOwner) {
      setError("Only the room owner can delete this room.");
      return;
    }

    if (room.outstandingAmount > 0) {
      setError("All member payments must be done before deleting this room.");
      return;
    }

    const previousRooms = rooms;
    const previousPendingDues = pendingDues;
    const previousSelectedRoomId = selectedRoomId;
    const nextSelectedRoomId =
      room.id === selectedRoomId
        ? rooms.find((item) => item.id !== room.id)?.id || ""
        : selectedRoomId;

    try {
      setDeletingRoomId(room.id);
      setRooms((prev) => prev.filter((item) => item.id !== room.id));
      setPendingDues((prev) => prev.filter((due) => due.roomId !== room.id));
      setSelectedRoomId(nextSelectedRoomId);
      setMessage("Deleting the Room...");

      await withTopProgress(async () => {
        await deleteSplitRoom(room.id);
        setMessage("Room deleted.");
        refreshSplitRoomDataInBackground(
          room.id === selectedRoomId ? undefined : selectedRoomId,
        );
      });
    } catch (deleteError) {
      setRooms(previousRooms);
      setPendingDues(previousPendingDues);
      setSelectedRoomId(previousSelectedRoomId);
      setError(
        `${
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete room"
        } The room was restored.`,
      );
      setMessage("");
    } finally {
      setDeletingRoomId("");
    }
  };

  function closePaymentDialog() {
    if (payingDueId) {
      return;
    }

    setPaymentDueId("");
    setPaymentWalletPin("");
    setPaymentMode("single");
    setPaymentPinDialogOpen(false);
    setPaymentDialogError("");
  }

  function closePaymentPinDialog() {
    if (payingDueId) {
      return;
    }

    setPaymentWalletPin("");
    setPaymentPinDialogOpen(false);
    setPaymentDialogError("");
  }

  function openPaymentPinDialog(mode: "single" | "all") {
    setMessage("");
    setError("");
    setPaymentDialogError("");
    setPaymentWalletPin("");
    setPaymentMode(mode);

    if (mode === "single" && !paymentDue) {
      setPaymentDialogError("Choose a pending due first.");
      return;
    }

    if (mode === "all" && paymentRoomPendingDues.length === 0) {
      setPaymentDialogError("No pending dues found in this room.");
      return;
    }

    setPaymentPinDialogOpen(true);
  }

  const handleConfirmWalletPayment = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setPaymentDialogError("");

    const firstPaymentTargetDue = paymentTargetDues[0];

    if (!firstPaymentTargetDue) {
      setPaymentDialogError("Choose a pending due first.");
      return;
    }

    const walletPin = paymentWalletPin.trim();

    if (!/^\d{4,6}$/.test(walletPin)) {
      setPaymentDialogError("Enter your 4 to 6 digit wallet PIN.");
      return;
    }

    const previousRooms = rooms;
    const previousPendingDues = pendingDues;
    const previousNetSettlements = netSettlements;

    try {
      setPayingDueId(paymentMode === "all" ? "all" : firstPaymentTargetDue.id);
      paymentTargetDues.forEach((due) => markPendingDuePaid(due.id));
      setMessage("Processing wallet payment...");

      await withTopProgress(async () => {
        for (const due of paymentTargetDues) {
          await paySplitRoomDue(due.id, { walletPin });
        }

        setMessage(
          paymentMode === "all"
            ? "All room dues paid from wallet successfully."
            : "Due paid from wallet successfully.",
        );
        setPaymentDueId("");
        setPaymentWalletPin("");
        setPaymentMode("single");
        setPaymentPinDialogOpen(false);
        refreshSplitRoomDataInBackground(firstPaymentTargetDue.roomId);
      });
    } catch (payError) {
      setRooms(previousRooms);
      setPendingDues(previousPendingDues);
      setNetSettlements(previousNetSettlements);
      setPaymentDialogError(
        `${
          payError instanceof Error
            ? payError.message
            : "Failed to pay due from wallet"
        } The due was restored as unpaid.`,
      );
      setMessage("");
    } finally {
      setPayingDueId("");
    }
  };


  function openNetSettlementPinDialog(settlement: NetSettlement) {
    setMessage("");
    setError("");
    setNetSettlementDialogError("");
    setNetSettlementWalletPin("");
    setNetSettlementTargetUserId(settlement.toUserId);
    setNetSettlementPinDialogOpen(true);
  }

  function closeNetSettlementPinDialog() {
    if (payingNetSettlementUserId) {
      return;
    }

    setNetSettlementPinDialogOpen(false);
    setNetSettlementTargetUserId("");
    setNetSettlementWalletPin("");
    setNetSettlementDialogError("");
  }

  async function handleConfirmNetSettlementPayment(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setNetSettlementDialogError("");

    if (!netSettlementTarget) {
      setNetSettlementDialogError("Choose an adjusted settlement first.");
      return;
    }

    const walletPin = netSettlementWalletPin.trim();

    if (!/^\d{4,6}$/.test(walletPin)) {
      setNetSettlementDialogError("Enter your 4 to 6 digit wallet PIN.");
      return;
    }

    const previousRooms = rooms;
    const previousPendingDues = pendingDues;
    const previousNetSettlements = netSettlements;

    try {
      setPayingNetSettlementUserId(netSettlementTarget.toUserId);
      setMessage("Processing adjusted settlement...");

      await withTopProgress(async () => {
        const response = await payNetSettlement({
          toUserId: netSettlementTarget.toUserId,
          walletPin,
        });

        setMessage(
          `${response.message}. ${formatCurrency(
            response.settlement.offsetAmount,
          )} was adjusted automatically.`,
        );
        setNetSettlementPinDialogOpen(false);
        setNetSettlementTargetUserId("");
        setNetSettlementWalletPin("");
        refreshSplitRoomDataInBackground(selectedRoomId);
      });
    } catch (settlementError) {
      setRooms(previousRooms);
      setPendingDues(previousPendingDues);
      setNetSettlements(previousNetSettlements);
      setNetSettlementDialogError(
        settlementError instanceof Error
          ? settlementError.message
          : "Failed to pay adjusted settlement",
      );
      setMessage("");
    } finally {
      setPayingNetSettlementUserId("");
    }
  }

  async function handleFinalizeRoom(room: SplitRoom) {
    if (!window.confirm(`Finalize ${room.name}? This locks the room after adjusted dues are cleared.`)) {
      return;
    }

    try {
      setFinalizingRoomId(room.id);
      setMessage("");
      setError("");

      await withTopProgress(() => finalizeSplitRoom(room.id));
      setRooms((prev) =>
        prev.map((item) =>
          item.id === room.id
            ? { ...item, isFinalized: true, finalizedAt: new Date().toISOString(), paymentStatus: "complete", status: "Complete" }
            : item,
        ),
      );
      refreshSplitRoomDataInBackground(room.id);
      setMessage("Room finalized and locked.");
    } catch (finalizeError) {
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : "Failed to finalize room",
      );
    } finally {
      setFinalizingRoomId("");
    }
  }

  async function handleArchiveRoom(room: SplitRoom) {
    if (!window.confirm(`Archive ${room.name}? It will stay visible as history but cannot be edited.`)) {
      return;
    }

    try {
      setArchivingRoomId(room.id);
      setMessage("");
      setError("");

      await withTopProgress(() => archiveSplitRoom(room.id));
      setRooms((prev) =>
        prev.map((item) =>
          item.id === room.id
            ? { ...item, isArchived: true, archivedAt: new Date().toISOString(), status: "Archived" }
            : item,
        ),
      );
      refreshSplitRoomDataInBackground(room.id);
      setMessage("Room archived.");
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Failed to archive room",
      );
    } finally {
      setArchivingRoomId("");
    }
  }

  return (
    <DashboardLayout eyebrow="Shared rooms">
      <section className="dashboard-page-grid split-rooms-grid">
          <article className="bento-card room-form-card">
            <div className="bento-card-head">
              <div>
                <span>Create room</span>
                <h2>Start a new split</h2>
              </div>
              <Plus size={23} />
            </div>

            <form className="dashboard-form" onSubmit={handleCreateRoom}>
              <div className="daily-room-name-preview">
                <span>Today&apos;s room</span>
                <strong>{getIndiaRoomName()}</strong>
                <small>Only one room can be created each day.</small>
              </div>
              <p className="dashboard-muted-text create-room-member-note">
                Start the room with yourself. Add friends later from Assign To or Split Between.
              </p>

              <button
                className="dashboard-primary-button"
                type="submit"
                disabled={savingRoom}
              >
                {savingRoom ? "Creating today's room" : "Create today's room"}
              </button>
            </form>
          </article>

          <article className="bento-card room-list-card">
            <div className="bento-card-head">
              <div className="room-list-title">
                <span>Rooms</span>
                <h2>Active rooms</h2>
              </div>
              <div className="room-list-icon" aria-hidden="true">
                <CalendarDays size={18} />
              </div>
            </div>

            <div className="room-card-list compact">
              {loading && (
                <p className="dashboard-muted-text">
                  <LoadingSkeleton wide />
                </p>
              )}
              {!loading && rooms.length === 0 && (
                <p className="dashboard-muted-text">
                  Create your first split room.
                </p>
              )}
              {rooms.map((room) => (
                <div
                  className={
                    selectedRoom?.id === room.id
                      ? "room-row room-row-live active"
                      : "room-row room-row-live"
                  }
                  key={room.id}
                >
                  <button
                    className="room-select-button"
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                  >
                    <div className="room-row-main">
                      <strong className="room-row-name">{room.name}</strong>
                      <span className="room-row-meta">
                        {room.memberCount} members
                        {room.isOwner ? " - Owner" : ""}
                        {room.isFinalized ? " - Finalized" : room.isArchived ? " - Archived" : ""}
                      </span>
                    </div>
                  </button>
                  {room.isOwner && (
                    <div className="room-row-actions">
                      <button
                        className="room-delete-button"
                        type="button"
                        aria-label={`Delete ${room.name}`}
                        title={
                          room.outstandingAmount > 0
                            ? "All member payments must be done before deleting this room"
                            : "Delete room"
                        }
                        onClick={() => handleDeleteRoom(room)}
                        disabled={
                          room.outstandingAmount > 0 ||
                          deletingRoomId === room.id
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                      {!room.isFinalized && !room.isArchived && (
                        <button
                          className="room-delete-button room-lock-button"
                          type="button"
                          aria-label={`Finalize ${room.name}`}
                          title="Finalize room after adjusted dues are cleared"
                          onClick={() => handleFinalizeRoom(room)}
                          disabled={finalizingRoomId === room.id || room.outstandingAmount > 0}
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                      {!room.isArchived && (
                        <button
                          className="room-delete-button room-archive-button"
                          type="button"
                          aria-label={`Archive ${room.name}`}
                          title="Archive room"
                          onClick={() => handleArchiveRoom(room)}
                          disabled={archivingRoomId === room.id}
                        >
                          <CalendarDays size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>

        <article className="bento-card member-balance-card members-only-card">
          <div className="bento-card-head">
            <div>
              <span>Members</span>
              <h2>Room members</h2>
            </div>
            <CheckCircle2 size={23} />
          </div>

          <div className="members-only-list">
            {!selectedRoom && (
              <p className="dashboard-muted-text">Choose a room to see its members.</p>
            )}
            {selectedRoom && sortedMembers.length === 0 && (
              <p className="dashboard-muted-text">No members in this room yet.</p>
            )}
            {selectedRoom &&
              sortedMembers.map((member) => (
                <div className="members-only-row" key={member.id}>
                  {renderMemberMiniAvatar(member)}
                  <div>
                    <strong>{getMemberName(member)}</strong>
                    <span>{member.isOwner ? "Room owner" : member.email || "Room member"}</span>
                  </div>
                </div>
              ))}
          </div>
        </article>

        <article className="bento-card assignment-card">
          <div className="bento-card-head">
            <div>
              <span>Assignment</span>
              <h2>Item assignment</h2>
            </div>
            <ReceiptText size={23} />
          </div>

          {selectedRoom && (
            <p className="dashboard-muted-text split-room-owner-only-note">
              {selectedRoomClosed ? (
                "This room is finalized or archived, so item edits are locked."
              ) : selectedRoom.isOwner ? (
                "Room owner"
              ) : (
                <>
                  Only the room owner can add items to this room. You can still
                  view your assigned items and pay your pending dues.
                </>
              )}
            </p>
          )}

          <form className="assignment-grid" onSubmit={handleAddItem}>
            <div className="split-mode-switch" role="group" aria-label="Splitting method">
              {(["manual", "automatic"] as const).map((mode) => (
                <button
                  className={splitMode === mode ? "active" : ""}
                  type="button"
                  key={mode}
                  onClick={() => setSplitMode(mode)}
                  disabled={savingItem || selectedRoomClosed}
                >
                  {mode === "manual" ? "Manual splitting" : "Automatic splitting"}
                </button>
              ))}
            </div>

            {splitMode === "manual" ? (
              <div className="assignment-picker-field assign-category">
                <span>Assign to</span>
                <button
                  className="assignment-friend-picker-button"
                  type="button"
                  onClick={() => openAssignmentFriendPicker("assign")}
                  disabled={savingItem || !selectedRoom?.isOwner || selectedRoomClosed}
                >
                  {assignedMemberLabel}
                </button>
              </div>
            ) : (
              <div className="assignment-picker-field automatic-member-picker-trigger">
                <span>Split between</span>
                <button
                  className="assignment-friend-picker-button"
                  type="button"
                  onClick={() => openAssignmentFriendPicker("automatic")}
                  disabled={savingItem || !selectedRoom?.isOwner || selectedRoomClosed}
                >
                  {automaticMembersLabel}
                </button>
              </div>
            )}

            <label className="assign-rooms">
              <span>Room</span>
              <Dropdown
                ariaLabel="Assignment room"
                value={selectedRoom?.id || ""}
                options={roomOptions}
                onChange={setSelectedRoomId}
                disabled={loading || rooms.length === 0}
              />
            </label>

            <label>
              <span>Item</span>
              <input
                type="text"
                placeholder={itemPlaceholder}
                value={itemTitle}
                onChange={(event) => setItemTitle(event.target.value)}
                disabled={savingItem || !selectedRoom || !selectedRoom.isOwner || selectedRoomClosed}
              />
            </label>

            <label>
              <span>Amount ({activeCurrency.symbol} {appCurrency})</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={formatCurrency(420)}
                value={itemAmount}
                onChange={(event) => setItemAmount(event.target.value)}
                disabled={savingItem || !selectedRoom || !selectedRoom.isOwner || selectedRoomClosed}
              />
            </label>

            {splitMode === "automatic" && automaticSharePreview.length > 0 && (
              <div className="automatic-share-preview">
                <span>Amount each person will pay</span>
                {automaticSharePreview.map((share) => (
                  <div key={share.memberId}>
                    <strong>{share.name}</strong>
                    <em>{formatCurrency(share.amount)}</em>
                  </div>
                ))}
              </div>
            )}

            <label className="assign-payer">
              <span>Paid by</span>
              <Dropdown
                ariaLabel="Who paid for this item"
                value={itemPaidByMemberId}
                options={memberOptions}
                onChange={setItemPaidByMemberId}
                placeholder="Choose payer"
                disabled={savingItem || sortedMembers.length === 0 || !selectedRoom?.isOwner || selectedRoomClosed}
              />
            </label>

            <button type="submit" disabled={savingItem || !selectedRoom || !selectedRoom.isOwner || selectedRoomClosed}>
              {savingItem ? "Adding item" : selectedRoomClosed ? "Room closed" : selectedRoom?.isOwner ? "Add item" : "Owner only"}
            </button>
          </form>
        </article>

        <article className="bento-card room-items-card split-room-history-card">
          <div className="bento-card-head">
            <div>
              <span>Split history</span>
              <h2>{selectedRoom ? selectedRoom.name : "No room selected"}</h2>
            </div>
            <ReceiptText size={23} />
          </div>

          <p className="dashboard-muted-text">
            View the full split history without changing the room layout.
          </p>

          <div className="split-room-history-preview">
            <div>
              <span>Items</span>
              <strong>{selectedRoomItems.length}</strong>
            </div>
            <div>
              <span>Members</span>
              <strong>{selectedRoom?.memberCount ?? 0}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCurrency(selectedRoom?.totalAmount ?? 0)}</strong>
            </div>
          </div>

          <div className="split-room-history-actions">
            <button
              className="dashboard-secondary-button split-room-history-open-button"
              type="button"
              onClick={() => setHistoryDialogOpen(true)}
              disabled={!selectedRoom}
            >
              <ReceiptText size={16} />
              Open room history
            </button>


          </div>
        </article>

        <article className="bento-card net-settlement-card">
          <div className="net-settlement-panel">
            <div className="bento-card-head">
              <div>
                <span>Adjusted settlements</span>
                <h2>Final payable after adjustment</h2>
              </div>
              <WalletCards size={23} />
            </div>

            <p className="dashboard-muted-text net-settlement-note">
              SplitVerse cancels opposite dues between the same friends first, then
              shows only the final amount that actually needs to move.
            </p>

            <div className="net-settlement-summary">
              <button
                className="net-settlement-metric payable"
                type="button"
                onClick={() => navigate(`/settlements/payable${selectedRoom?.id ? `?roomId=${encodeURIComponent(selectedRoom.id)}` : ""}`)}
              >
                <span>Payable</span>
                <strong>{formatCurrency(netSettlementOutgoingTotal)}</strong>
                <em>You pay after offsets</em>
              </button>
              <button
                className="net-settlement-metric receivable"
                type="button"
                onClick={() => navigate(`/settlements/receivable${selectedRoom?.id ? `?roomId=${encodeURIComponent(selectedRoom.id)}` : ""}`)}
              >
                <span>Receivable</span>
                <strong>{formatCurrency(netSettlementIncomingTotal)}</strong>
                <em>You receive after offsets</em>
              </button>
            </div>
          </div>
        </article>

        {(message || error) && (
          <article
            className={
              error ? "bento-card page-alert error" : "bento-card page-alert"
            }
          >
            {error || message}
          </article>
        )}
      </section>

      {assignmentFriendPickerMode && selectedRoom && (
        <div className="assignment-friend-picker-backdrop" role="presentation">
          <div
            className="assignment-friend-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-friend-picker-title"
          >
            <div className="assignment-friend-picker-head">
              <div>
                <span>{assignmentFriendPickerMode === "assign" ? "Assign item" : "Automatic split"}</span>
                <h2 id="assignment-friend-picker-title">
                  {assignmentFriendPickerMode === "assign" ? "Choose a person" : "Choose people"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close friend selection"
                onClick={() => setAssignmentFriendPickerMode(null)}
                disabled={savingPickerSelection}
              >
                <X size={18} />
              </button>
            </div>

            <label className="assignment-friend-picker-search">
              <span>Search friends</span>
              <input
                type="search"
                placeholder="Search by name or email"
                value={friendSearch}
                onChange={(event) => setFriendSearch(event.target.value)}
                disabled={savingPickerSelection}
              />
            </label>

            <div className="assignment-friend-picker-list">
              <button
                type="button"
                className={pickerSelectedValues.includes(selfPickerValue) ? "selected" : ""}
                onClick={() => togglePickerValue(selfPickerValue)}
                disabled={savingPickerSelection}
              >
                {renderMemberMiniAvatar(sortedMembers.find((member) => member.isMe))}
                <span><strong>Me</strong><small>Current user</small></span>
              </button>

              {filteredFriends.map((friend) => {
                const selected = pickerSelectedValues.includes(friend.email);
                const alreadyInRoom = selectedRoom.members.some(
                  (member) => member.email?.toLowerCase() === friend.email.toLowerCase(),
                );

                return (
                  <button
                    type="button"
                    className={selected ? "selected" : ""}
                    key={friend.id}
                    onClick={() => togglePickerValue(friend.email)}
                    disabled={savingPickerSelection}
                  >
                    <span className="assignment-friend-picker-avatar">
                      {renderFriendMiniAvatar(friend)}
                    </span>
                    <span>
                      <strong>{friend.name || friend.email.split("@")[0]}</strong>
                      <small>{alreadyInRoom ? "Already in room" : friend.email}</small>
                    </span>
                  </button>
                );
              })}

              {filteredFriends.length === 0 && trimmedFriendSearch && (
                <p className="dashboard-muted-text">No friends match {trimmedFriendSearch}.</p>
              )}
            </div>

            <div className="assignment-friend-picker-footer">
              <span>{pickerSelectedValues.length} selected</span>
              <button
                className="dashboard-primary-button"
                type="button"
                onClick={() => void applyAssignmentFriendSelection()}
                disabled={savingPickerSelection || pickerSelectedValues.length === 0}
              >
                {savingPickerSelection
                  ? "Updating room"
                  : assignmentFriendPickerMode === "assign"
                    ? "Assign to selected person"
                    : "Split between selected people"}
              </button>
            </div>
          </div>
        </div>
      )}

      {netSettlementInfoDialog && (
        <div className="split-room-payment-backdrop" role="presentation">
          <div
            className="split-room-payment-dialog net-settlement-info-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="net-settlement-info-title"
          >
            <div className="split-room-payment-head">
              <div>
                <span>Adjusted settlements</span>
                <h2 id="net-settlement-info-title">
                  {netSettlementInfoDialog === "payable"
                    ? "Payable details"
                    : "Receivable details"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close adjusted settlement details"
                onClick={() => setNetSettlementInfoDialog(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="split-room-payment-summary net-settlement-info-summary">
              <div>
                <span>Final amount</span>
                <strong>{formatCurrency(visibleNetSettlementTotal)}</strong>
                <small>After opposite dues are adjusted</small>
              </div>
              <div>
                <span>Direction</span>
                <strong>
                  {netSettlementInfoDialog === "payable"
                    ? "You pay"
                    : "You receive"}
                </strong>
                <small>Calculated across shared split rooms</small>
              </div>
              <div>
                <span>People</span>
                <strong>{visibleNetSettlements.length}</strong>
                <small>
                  {visibleNetSettlements.length === 1
                    ? "Adjusted settlement"
                    : "Adjusted settlements"}
                </small>
              </div>
            </div>

            <div className="split-room-payment-method net-settlement-info-note">
              <WalletCards size={20} />
              <div>
                <strong>Final payable after adjustment</strong>
                <small>
                  SplitVerse cancels opposite dues between the same friends first,
                  then shows only the final amount that actually needs to move.
                </small>
              </div>
            </div>

            <div className="net-settlement-list net-settlement-detail-list">
              {loading && (
                <p className="dashboard-muted-text net-settlement-empty">
                  <LoadingSkeleton wide />
                </p>
              )}

              {!loading && visibleNetSettlements.length === 0 && (
                <p className="dashboard-muted-text net-settlement-empty">
                  No {netSettlementInfoDialog} adjusted settlements yet.
                </p>
              )}

              {visibleNetSettlements.map((settlement) => {
                const fromLabel = settlement.isOutgoing
                  ? "You"
                  : settlement.fromName || settlement.fromEmail;
                const toLabel = settlement.isIncoming
                  ? "you"
                  : settlement.toName || settlement.toEmail;
                const counterparty = settlement.isOutgoing
                  ? settlement.toName || settlement.toEmail
                  : settlement.fromName || settlement.fromEmail;
                const directionLabel = settlement.isOutgoing
                  ? "Payable"
                  : "Receivable";
                const directionClass = settlement.isOutgoing
                  ? "payable"
                  : "receivable";
                const settlementTitle = settlement.isOutgoing
                  ? `You - pay ${toLabel}`
                  : `${fromLabel} - pays you`;

                return (
                  <div
                    className={[
                      "net-settlement-row",
                      settlement.isOutgoing ? "outgoing" : "incoming",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={`${settlement.fromUserId}-${settlement.toUserId}`}
                  >
                    <div className="net-settlement-row-main">
                      <span
                        className={`net-settlement-direction-pill ${directionClass}`}
                      >
                        {directionLabel}
                      </span>
                      <strong>{settlementTitle}</strong>
                      <span>
                        {settlement.breakdown.length} room item
                        {settlement.breakdown.length === 1 ? "" : "s"} adjusted
                        with {counterparty}
                      </span>
                      <ul>
                        {settlement.breakdown.map((line) => (
                          <li key={`${line.itemId}-${line.direction}`}>
                            <span>{line.direction}</span>
                            <em>
                              {`${line.roomName} - ${line.title} - ${formatCurrency(line.amount)}`}
                            </em>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <aside className="net-settlement-amount-panel">
                      <span>Final amount</span>
                      <strong>{formatCurrency(settlement.amount)}</strong>
                      {settlement.isOutgoing ? (
                        <button
                          className="dashboard-primary-button"
                          type="button"
                          onClick={() => {
                            setNetSettlementInfoDialog(null);
                            openNetSettlementPinDialog(settlement);
                          }}
                          disabled={
                            payingNetSettlementUserId === settlement.toUserId
                          }
                        >
                          {payingNetSettlementUserId === settlement.toUserId
                            ? "Paying"
                            : "Pay net"}
                        </button>
                      ) : (
                        <span className="status-pill">Receivable</span>
                      )}
                    </aside>
                  </div>
                );
              })}
            </div>

            <div className="split-room-payment-actions">
              <button
                className="dashboard-secondary-button"
                type="button"
                onClick={() => setNetSettlementInfoDialog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {netSettlementPinDialogOpen && netSettlementTarget && (
        <div className="split-room-payment-pin-backdrop" role="presentation">
          <form
            className="split-room-payment-pin-dialog net-settlement-pin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="net-settlement-payment-title"
            onSubmit={handleConfirmNetSettlementPayment}
          >
            <div className="split-room-payment-head">
              <div>
                <span>Adjusted wallet payment</span>
                <h2 id="net-settlement-payment-title">Pay final net amount</h2>
              </div>
              <button
                type="button"
                aria-label="Close adjusted settlement payment"
                onClick={closeNetSettlementPinDialog}
                disabled={Boolean(payingNetSettlementUserId)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="split-room-payment-pin-summary">
              <span>
                To {netSettlementTarget.toName || netSettlementTarget.toEmail}
              </span>
              <strong>{formatCurrency(netSettlementTarget.amount)}</strong>
              <small>
                Opposite dues are adjusted first. Only this final amount will be
                paid from your wallet.
              </small>
            </div>

            <label className="settings-field split-room-payment-pin-field">
              <span>Wallet PIN</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                placeholder="Enter 4 to 6 digit PIN"
                value={netSettlementWalletPin}
                disabled={Boolean(payingNetSettlementUserId)}
                onChange={(event) =>
                  setNetSettlementWalletPin(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
              />
            </label>

            {netSettlementDialogError && (
              <p className="split-room-payment-error">
                {netSettlementDialogError}
              </p>
            )}

            <div className="split-room-payment-actions">
              <button
                className="dashboard-secondary-button"
                type="button"
                onClick={closeNetSettlementPinDialog}
                disabled={Boolean(payingNetSettlementUserId)}
              >
                Cancel
              </button>
              <button
                className="dashboard-primary-button"
                type="submit"
                disabled={Boolean(payingNetSettlementUserId)}
              >
                {payingNetSettlementUserId
                  ? "Paying"
                  : `Pay ${formatCurrency(netSettlementTarget.amount)}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {paymentDue && paymentRoom && (
        <div className="split-room-payment-backdrop" role="presentation">
          <div
            className="split-room-payment-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="split-room-payment-title"
          >
            <div className="split-room-payment-head">
              <div>
                <span>Wallet payment</span>
                <h2 id="split-room-payment-title">Member payment</h2>
              </div>
              <button
                type="button"
                aria-label="Close payment popup"
                onClick={closePaymentDialog}
                disabled={Boolean(payingDueId)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="split-room-payment-summary">
              <div>
                <span>Room</span>
                <strong>{paymentDue.roomName}</strong>
                <small>Total room spend: {formatCurrency(paymentRoom.totalAmount)}</small>
              </div>
              <div>
                <span>Pay to</span>
                <strong>
                  {paymentReceiverMember
                    ? getMemberName(paymentReceiverMember)
                    : paymentDue.receiverName || paymentDue.receiverEmail}
                </strong>
                <small>{paymentDue.receiverEmail}</small>
              </div>
              <div>
                <span>Your due</span>
                <strong>{formatCurrency(paymentDue.amount)}</strong>
                <small>{`For ${paymentDue.title}`}</small>
              </div>
            </div>

            <div className="split-room-payment-method">
              <WalletCards size={20} />
              <div>
                <strong>Pay from SplitVerse Wallet</strong>
                <small>
                  Select one item or use Pay All for every pending due in this room.
                </small>
              </div>
            </div>

            <div className="split-room-payment-member-card">
              <div className="split-room-payment-member-head">
                {renderMemberMiniAvatar(paymentPayerMember ?? undefined)}
                <div>
                  <span>Member details</span>
                  <small>
                    {`Total items assigned to you: ${formatCurrency(paymentMemberTotal)}`}
                  </small>
                </div>
              </div>

              <div className="split-room-payment-items">
                <span>Items you are entitled to</span>
                <div className="split-room-payment-item-list">
                  {paymentEntitledItems.length === 0 ? (
                    <p className="dashboard-muted-text">No assigned items found.</p>
                  ) : (
                    paymentEntitledItems.map((item) => {
                      const selectableDue = paymentPendingDueByItemId.get(item.id);
                      const selectable = Boolean(selectableDue);
                      const active = item.id === paymentDue.id;

                      return (
                        <div
                          className={[
                            "split-room-payment-item-row",
                            item.isCollected ? "paid" : "pending",
                            active ? "active" : "",
                            selectable ? "selectable" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={item.id}
                          role={selectable ? "button" : undefined}
                          tabIndex={selectable ? 0 : undefined}
                          onClick={() => {
                            if (selectableDue) {
                              setPaymentDueId(selectableDue.id);
                              setPaymentDialogError("");
                            }
                          }}
                          onKeyDown={(event) => {
                            if (
                              !selectableDue ||
                              (event.key !== "Enter" && event.key !== " ")
                            ) {
                              return;
                            }

                            event.preventDefault();
                            setPaymentDueId(selectableDue.id);
                            setPaymentDialogError("");
                          }}
                        >
                          <div>
                            <strong>{item.title}</strong>
                            <small>
                              {item.isCollected
                                ? "Paid"
                                : active
                                  ? "Selected for payment"
                                  : selectable
                                    ? "Tap to select"
                                    : "Pending"}
                            </small>
                          </div>
                          <em>{formatCurrency(item.amount)}</em>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {paymentPendingItems.length > 1 && (
              <p className="split-room-payment-note">
                {`You have ${paymentPendingItems.length} pending items in this room.`}
                Use Pay All to clear every pending item in this room.
              </p>
            )}

            {paymentDialogError && (
              <p className="split-room-payment-error">{paymentDialogError}</p>
            )}

            <div className="split-room-payment-actions">
              <button
                className="dashboard-secondary-button"
                type="button"
                onClick={closePaymentDialog}
                disabled={Boolean(payingDueId)}
              >
                Cancel
              </button>
              <button
                className="dashboard-secondary-button"
                type="button"
                onClick={() => openPaymentPinDialog("all")}
                disabled={Boolean(payingDueId) || paymentRoomPendingDues.length === 0}
              >
                Pay All
              </button>
              <button
                className="dashboard-primary-button"
                type="button"
                onClick={() => openPaymentPinDialog("single")}
                disabled={Boolean(payingDueId)}
              >
                {`Pay ${formatCurrency(paymentDue.amount)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentPinDialogOpen && paymentRoom && paymentTargetDues.length > 0 && (
        <div className="split-room-payment-pin-backdrop" role="presentation">
          <form
            className="split-room-payment-pin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="split-room-payment-pin-title"
            onSubmit={handleConfirmWalletPayment}
          >
            <div className="split-room-payment-head">
              <div>
                <span>Wallet PIN</span>
                <h2 id="split-room-payment-pin-title">Confirm payment</h2>
              </div>
              <button
                type="button"
                aria-label="Close wallet PIN popup"
                onClick={closePaymentPinDialog}
                disabled={Boolean(payingDueId)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="split-room-payment-pin-summary">
              <span>{paymentMode === "all" ? "Pay All" : "Pay selected"}</span>
              <strong>{formatCurrency(paymentTargetAmount)}</strong>
              <small>
                {paymentMode === "all"
                  ? `${paymentTargetDues.length} pending dues in ${paymentRoom.name}`
                  : (paymentTargetDues[0]?.title ?? "Selected due")}
              </small>
            </div>

            <label className="settings-field split-room-payment-pin-field">
              <span>Wallet PIN</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                placeholder="Enter 4 to 6 digit PIN"
                value={paymentWalletPin}
                disabled={Boolean(payingDueId)}
                onChange={(event) =>
                  setPaymentWalletPin(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
              />
            </label>

            {paymentDialogError && (
              <p className="split-room-payment-error">{paymentDialogError}</p>
            )}

            <div className="split-room-payment-actions">
              <button
                className="dashboard-secondary-button"
                type="button"
                onClick={closePaymentPinDialog}
                disabled={Boolean(payingDueId)}
              >
                Cancel
              </button>
              <button
                className="dashboard-primary-button"
                type="submit"
                disabled={Boolean(payingDueId)}
              >
                {payingDueId
                  ? "Paying"
                  : paymentMode === "all"
                    ? `Pay All ${formatCurrency(paymentTargetAmount)}`
                    : `Pay ${formatCurrency(paymentTargetAmount)}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {historyDialogOpen && selectedRoom && (
        <div className="split-room-history-backdrop" role="presentation">
          <div
            className="split-room-history-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="split-room-history-title"
          >
            <div className="split-room-history-head">
              <div>
                <span>Split room history</span>
                <h2 id="split-room-history-title">{selectedRoom.name}</h2>
              </div>
              <button
                type="button"
                aria-label="Close split room history"
                onClick={closeHistoryDialog}
                disabled={Boolean(updatingItemId || deletingItemId)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="split-room-history-stats">
              <div>
                <span>Total items</span>
                <strong>{selectedRoomItems.length}</strong>
              </div>
              <div>
                <span>Room total</span>
                <strong>{formatCurrency(selectedRoom.totalAmount)}</strong>
              </div>
            </div>

            <div className="split-room-history-list">
              {selectedRoomItems.length === 0 && (
                <p className="dashboard-muted-text">
                  No items added in this room yet.
                </p>
              )}

              {selectedRoomItems.map((item) => {
                const canManageItem =
                  Boolean(selectedRoom.isOwner) && !item.isCollected;
                const isEditing = editingItemId === item.id;
                const paidByMember = selectedRoom.members.find(
                  (member) =>
                    member.id === (item.paidByMemberId || item.paid_by_member_id),
                );
                const paidByLabel =
                  item.paidByName ||
                  item.paidByEmail ||
                  (paidByMember ? getMemberName(paidByMember) : "Room payer");

                return (
                  <div
                    className={[
                      "split-room-history-row",
                      item.isCollected ? "collected" : "",
                      isEditing ? "editing" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={item.id}
                  >
                    {isEditing ? (
                      <form
                        className="split-room-history-edit-form"
                        onSubmit={handleUpdateItem}
                      >
                        <label>
                          <span>Item name</span>
                          <input
                            type="text"
                            value={editItemTitle}
                            onChange={(event) =>
                              setEditItemTitle(event.target.value)
                            }
                            disabled={updatingItemId === item.id}
                          />
                        </label>

                        <label>
                          <span>Amount ({activeCurrency.symbol} {appCurrency})</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editItemAmount}
                            onChange={(event) =>
                              setEditItemAmount(event.target.value)
                            }
                            disabled={updatingItemId === item.id}
                          />
                        </label>

                        <div className="split-room-history-edit-actions">
                          <button
                            className="split-room-history-delete-button"
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            disabled={
                              deletingItemId === item.id ||
                              updatingItemId === item.id
                            }
                          >
                            <Trash2 size={14} />
                            {deletingItemId === item.id ? "Deleting" : "Delete"}
                          </button>

                          <div>
                            <button
                              className="dashboard-secondary-button"
                              type="button"
                              onClick={cancelEditingItem}
                              disabled={
                                deletingItemId === item.id ||
                                updatingItemId === item.id
                              }
                            >
                              Cancel
                            </button>
                            <button
                              className="dashboard-primary-button"
                              type="submit"
                              disabled={
                                deletingItemId === item.id ||
                                updatingItemId === item.id
                              }
                            >
                              {updatingItemId === item.id
                                ? "Saving"
                                : "Save changes"}
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <>
                        <ReceiptText size={16} />
                        <div className="room-item-meta">
                          <span>{item.title}</span>
                          <strong>
                            {`Assigned to ${getRoomItemMemberName(
                              item.assigned_member_id,
                            )}`}
                          </strong>
                          <small>{`Paid by ${paidByLabel}`}</small>
                        </div>
                        <em>{formatCurrency(item.amount)}</em>
                        <span
                          className={
                            item.isCollected
                              ? "item-status-pill paid"
                              : "item-status-pill pending"
                          }
                        >
                          {item.isCollected ? "Collected" : "Pending"}
                        </span>
                        <button
                          className="split-room-history-manage-button"
                          type="button"
                          onClick={() => startEditingItem(item)}
                          disabled={
                            !canManageItem || deletingItemId === item.id
                          }
                          title={
                            canManageItem
                              ? "Manage item"
                              : "Collected items cannot be changed"
                          }
                        >
                          <Pencil size={14} />
                          Manage
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="split-room-history-footer">
              <p>
                Pending items can be edited or deleted. Collected items stay
                locked so expenses, wallet payments, and room balances remain
                safe.
              </p>
              <button
                className="dashboard-secondary-button"
                type="button"
                onClick={closeHistoryDialog}
                disabled={Boolean(updatingItemId || deletingItemId)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
