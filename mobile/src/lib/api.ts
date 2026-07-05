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