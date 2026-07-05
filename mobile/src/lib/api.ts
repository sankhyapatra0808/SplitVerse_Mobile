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
    walletBalance?: number;
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
  };
};

export type DbUser = {
  id: string;
  firebase_uid?: string;
  email: string;
  name?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
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
  return apiFetch<FriendActivityResponse>(
    `/api/friends/${friendId}/activity`,
  );
}