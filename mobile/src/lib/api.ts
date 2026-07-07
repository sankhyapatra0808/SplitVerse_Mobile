import { auth } from "./firebase";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  console.warn("EXPO_PUBLIC_API_URL is missing in mobile/.env");
}

async function getAuthToken() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("You are not logged in.");
  }

  return currentUser.getIdToken();
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed");
  }

  return data as T;
}

export type DashboardSummary = {
  metrics?: {
    todayExpense?: number;
    pendingPayment?: number;
    todaySavings?: number;
    walletBalance?: number;
  };

  expenseTracker?: {
    totalSpentToday?: number;
    timeSlots?: {
      label: string;
      amount: number;
      peakHour?: string;
    }[];
  };

  walletHealth?: {
    availableBalance?: number;
    receivable?: number;
    payable?: number;
    netPosition?: number;
  };

  monthlySpend?: {
    graphTotal?: number;
    currentMonthTotal?: number;
    currentMonthLabel?: string;
    months?: {
      label: string;
      amount: number;
      value?: number;
      peakDay?: number | string;
      peakSpendingDay?: number | string;
    }[];
  };

  spendingInsight?: {
    text: string;
  };
};

export type DbUser = {
  id: string;
  firebase_uid?: string;
  email: string;
  name?: string | null;
  display_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  profile_photo_url?: string | null;
  display_photo_url?: string | null;
  avatar_mode?: string | null;
  wallet_balance?: number;
};

export async function syncCurrentUser() {
  return apiFetch<{ message: string; user: DbUser }>("/api/auth/sync-user", {
    method: "POST",
  });
}

export async function getCurrentDbUser() {
  return apiFetch<{ user: DbUser }>("/api/auth/me");
}

export async function getDashboardSummary() {
  return apiFetch<DashboardSummary>("/api/dashboard/summary");
}

// friends api
export type Friend = {
  id: string;
  name: string | null;
  email: string;
  photo_url?: string | null;
  profile_photo_url?: string | null;
  display_photo_url?: string | null;
  avatar_mode?: string | null;
  friendship_created_at?: string;
  friendship_days?: number;
};

export type FriendRequest = {
  id: string;
  requester_user_id: string;
  requester_name: string | null;
  requester_email: string;
  recipient_email: string;
  status: string;
  emailStatus?: "sent" | "degraded" | "failed" | "skipped";
  created_at?: string;
  updated_at?: string;
};

export type FriendsSummary = {
  friends: Friend[];
  receivedRequests: FriendRequest[];
  sentRequests: FriendRequest[];
};

export type FriendActivityResponse = {
  friend: {
    id?: string;
    name: string | null;
    email: string;
  };
  summary: {
    roomsTogether: number;
    totalSettled: number;
    netPosition: number;
  };
  recentActivity: {
    id: string;
    title: string;
    source: string;
    amount: number;
  }[];
};

export async function getFriendsSummary() {
  return apiFetch<FriendsSummary>("/api/friends");
}

export async function sendFriendRequest(email: string) {
  return apiFetch<{ message: string; request: FriendRequest }>(
    "/api/friends/requests",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export async function acceptFriendRequest(requestId: string) {
  return apiFetch<{ message: string }>(
    `/api/friends/requests/${requestId}/accept`,
    {
      method: "POST",
    },
  );
}

export async function getFriendActivity(friendId: string) {
  return apiFetch<FriendActivityResponse>(`/api/friends/${friendId}/activity`);
}

export type SplitRoomMember = {
  id: string;
  user_id?: string;
  email: string;
  display_name?: string | null;
  name?: string | null;
  photo_url?: string | null;
  profile_photo_url?: string | null;
  display_photo_url?: string | null;
  avatar_mode?: string | null;
  isMe?: boolean;
  isOwner?: boolean;
};

export type SplitRoomBalance = {
  memberId: string;
  assignedTotal?: number;
  paidTotal?: number;
  pendingTotal?: number;
  collectedTotal?: number;
  totalAssigned?: number;
  totalPaid?: number;
  totalPending?: number;
};

export type SplitRoomItem = {
  id: string;
  room_id?: string;
  assigned_member_id: string;
  assignedMemberId?: string;
  title: string;
  amount: number;
  settled_amount?: number;
  pending_amount?: number;
  collected_at?: string | null;
  expense_id?: string | null;
  isCollected?: boolean;
  created_at?: string;
};

export type SplitRoom = {
  id: string;
  name: string;
  category?: string | null;
  status?: string;
  isOwner?: boolean;
  isArchived?: boolean;
  isFinalized?: boolean;
  ownerEmail?: string;
  paidByEmail?: string | null;
  paid_by_email?: string | null;
  created_at?: string;
  memberCount?: number;
  totalAmount?: number;
  outstandingAmount?: number;
  collectedAmount?: number;
  members: SplitRoomMember[];
  balances: SplitRoomBalance[];
  items: SplitRoomItem[];
};

export type CreateSplitRoomPayload = {
  name: string;
  category: string;
  members: string[];
  paidByEmail?: string;
};

export type TransactionStatus =
  | "all"
  | "received"
  | "paid"
  | "pending"
  | "added";

export type TransactionItem = {
  id: string;
  title: string;
  room?: string;
  amount: number;
  status: string;
  displayStatus?: string;
  type?: string;
  createdAt: string;
  displayDate?: string;
};

export type TransactionsResponse = {
  transactions: TransactionItem[];
  summary: {
    netMovement: number;
    count: number;
    totalTillDate?: number;
    visibleCount?: number;
    accountCreatedAt?: string;
  };
};

export async function getTransactions(params?: {
  search?: string;
  status?: TransactionStatus;
  limit?: number;
  exportMode?: "count" | "year";
  year?: number;
}) {
  const searchParams = new URLSearchParams();

  if (params?.search) {
    searchParams.set("search", params.search);
  }

  if (params?.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }

  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }

  if (params?.exportMode) {
    searchParams.set("exportMode", params.exportMode);
  }

  if (params?.year) {
    searchParams.set("year", String(params.year));
  }

  const queryString = searchParams.toString();

  return apiFetch<TransactionsResponse>(
    `/api/transactions${queryString ? `?${queryString}` : ""}`,
  );
}

export async function getSplitRooms() {
  return apiFetch<{ rooms: SplitRoom[] }>("/api/split-rooms");
}

export async function createSplitRoom(payload: CreateSplitRoomPayload) {
  return apiFetch<{ message: string; room: SplitRoom }>("/api/split-rooms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ITEM SPLIT ROOM API
export type CreateSplitRoomItemPayload = {
  title: string;
  amount: number;
  assignedMemberId: string;
};

export type UpdateSplitRoomItemPayload = {
  title: string;
  amount: number;
};

export async function createSplitRoomItem(
  roomId: string,
  payload: CreateSplitRoomItemPayload,
) {
  return apiFetch<{ message: string; item: SplitRoomItem }>(
    `/api/split-rooms/${roomId}/items`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateSplitRoomItem(
  itemId: string,
  payload: UpdateSplitRoomItemPayload,
) {
  return apiFetch<{ message: string; item: SplitRoomItem }>(
    `/api/split-rooms/items/${itemId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteSplitRoomItem(itemId: string) {
  return apiFetch<{ message: string }>(`/api/split-rooms/items/${itemId}`, {
    method: "DELETE",
  });
}

// settlements api
export type NetSettlementBreakdown = {
  itemId: string;
  roomId: string;
  roomName: string;
  title: string;
  direction: string;
  amount: number;
  originalAmount: number;
  settledAmount: number;
  createdAt: string;
};

export type NetSettlement = {
  fromUserId: string;
  fromName: string | null;
  fromEmail: string;
  toUserId: string;
  toName: string | null;
  toEmail: string;
  amount: number;
  currency: "INR";
  isOutgoing: boolean;
  isIncoming: boolean;
  breakdown: NetSettlementBreakdown[];
};

export type NetSettlementsResponse = {
  settlements: NetSettlement[];
  summary: {
    outgoingTotal: number;
    incomingTotal: number;
    netPosition: number;
    currency: "INR";
  };
};

export async function getNetSettlements() {
  return apiFetch<NetSettlementsResponse>("/api/split-rooms/net-settlements");
}

export async function payNetSettlement(payload: {
  toUserId: string;
  walletPin: string;
}) {
  return apiFetch<{
    message: string;
    settlement: {
      fromUserId: string;
      toUserId: string;
      amount: number;
      currency: "INR";
      offsetAmount: number;
      expenseId: string;
    };
  }>("/api/split-rooms/net-settlements/pay", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}