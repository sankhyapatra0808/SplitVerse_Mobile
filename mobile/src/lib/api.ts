import { auth } from "./firebase";
import {
  AppError,
  createFetchFailureError,
  createHttpError,
  normalizeAppError,
} from "./errors";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const REQUEST_TIMEOUT_MS = 15000;

if (!API_URL) {
  console.warn("EXPO_PUBLIC_API_URL is missing in mobile/.env");
}

function getApiUrl(path: string) {
  if (!API_URL) {
    throw new AppError({
      code: "CONFIGURATION_ERROR",
      title: "Server address missing",
      message:
        "This app build does not have EXPO_PUBLIC_API_URL configured. Add the backend URL and restart Expo.",
    });
  }

  const value = `${API_URL}${path}`;

  try {
    const parsedUrl = new URL(value);
    const localDevelopmentHost =
      __DEV__ &&
      ["localhost", "127.0.0.1", "10.0.2.2"].includes(parsedUrl.hostname);

    if (parsedUrl.protocol !== "https:" && !localDevelopmentHost) {
      throw new Error("Insecure API URL");
    }

    return parsedUrl.toString();
  } catch {
    throw new AppError({
      code: "CONFIGURATION_ERROR",
      title: "Invalid server address",
      message:
        "EXPO_PUBLIC_API_URL must use HTTPS. Local HTTP is allowed only for localhost, 127.0.0.1, or 10.0.2.2 during development.",
    });
  }
}

function getRequestAction(path: string) {
  if (path.includes("exchange-rates")) return "loading exchange rates";
  if (path.includes("dashboard")) return "loading the dashboard";
  if (path.includes("friends")) return "updating friend information";
  if (path.includes("split-rooms")) return "updating split-room information";
  if (path.includes("wallet-order") || path.includes("verify-wallet-payment")) {
    return "processing the wallet top-up";
  }
  if (path.includes("wallet")) return "loading wallet information";
  if (path.includes("transactions")) return "loading transaction information";
  if (path.includes("expenses")) return "saving the expense";
  if (path.includes("profile-photo")) return "uploading the profile photo";
  if (path.includes("profile")) return "saving profile settings";
  if (path.includes("wallet-pin")) return "updating wallet security";
  if (path.includes("email-login-otp")) return "verifying the email login code";
  if (path.includes("password-reset")) return "resetting your password";
  if (path.includes("auth")) return "verifying your account";
  return "contacting SplitVerse";
}

async function getAuthToken() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new AppError({
      code: "AUTH_REQUIRED",
      title: "Sign in required",
      message: "Your session is no longer active. Sign in again to continue.",
    });
  }

  try {
    return await currentUser.getIdToken();
  } catch (error) {
    throw normalizeAppError(error, {
      title: "Could not verify your session",
      fallbackMessage: "SplitVerse could not verify your sign-in session. Sign in again and retry.",
    });
  }
}

function isFormDataBody(body: RequestInit["body"]) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

async function requestJson<T>(
  path: string,
  options: RequestInit,
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const externalSignal = options.signal;
  const abortFromExternalSignal = () => controller.abort();
  externalSignal?.addEventListener?.("abort", abortFromExternalSignal);

  const bodyIsFormData = isFormDataBody(options.body);

  try {
    const response = await fetch(getApiUrl(path), {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(bodyIsFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

    const rawText = await response.text();
    let data: unknown = null;

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        if (response.ok) {
          throw new AppError({
            code: "INVALID_RESPONSE",
            title: "Invalid server response",
            message:
              "SplitVerse received an unreadable response from the server. Please try again shortly.",
            status: response.status,
            retryable: true,
          });
        }
      }
    }

    if (!response.ok) {
      throw createHttpError(response.status, data, path);
    }

    return data as T;
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw await createFetchFailureError(error, {
      timedOut,
      action: getRequestAction(path),
    });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener?.("abort", abortFromExternalSignal);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAuthToken();
  return requestJson<T>(path, options, token);
}

export async function publicApiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return requestJson<T>(path, options);
}

export type ExchangeRatesSource = "live" | "cache" | "stale-cache" | "fallback";

export type ExchangeRatesResponse = {
  base: string;
  rates: Record<string, number>;
  source: ExchangeRatesSource;
  provider: string;
  fetchedAt: string | null;
  expiresAt: string | null;
};

export async function getExchangeRates(base = "INR", symbols: string[] = []) {
  const searchParams = new URLSearchParams({ base });

  if (symbols.length > 0) {
    searchParams.set("symbols", symbols.join(","));
  }

  return publicApiFetch<ExchangeRatesResponse>(
    `/api/exchange-rates?${searchParams.toString()}`,
  );
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
  has_wallet_pin?: boolean;
  app_currency?: string | null;
  app_language?: string | null;
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

export type CreateExpensePayload = {
  title: string;
  category?: string | null;
  amount: number;
  expenseDate?: string | null;
};

export type ExpenseItem = {
  id: string;
  title: string;
  category?: string | null;
  amount: number;
  expense_date?: string;
  created_at?: string;
};

export async function createExpense(payload: CreateExpensePayload) {
  return apiFetch<{ message: string; expense: ExpenseItem }>("/api/expenses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

  name?: string | null;
  detail?: string | null;
  amount?: number;
  outstandingAmount?: number;
  collectedAmount?: number;
  isMe?: boolean;
  isCollected?: boolean;
  itemCount?: number;

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
  type: string;
  amount: number;

  title?: string | null;
  description?: string | null;

  status?: string | null;
  displayStatus?: string | null;

  createdAt: string;
  displayDate?: string;

  roomName?: string | null;
  counterpartyName?: string | null;
  counterpartyEmail?: string | null;
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

export async function collectSplitRoomMemberDues(
  roomId: string,
  memberId: string,
) {
  return apiFetch<{ message: string; updatedCount: number }>(
    `/api/split-rooms/${roomId}/members/${memberId}/collect`,
    {
      method: "POST",
    },
  );
}

export async function sendSplitRoomReminder(roomId: string) {
  return apiFetch<{ message: string; remindedCount: number }>(
    `/api/split-rooms/${roomId}/reminders`,
    {
      method: "POST",
    },
  );
}

export async function removeSplitRoomMember(roomId: string, memberId: string) {
  return apiFetch<{ message: string; removedMemberId: string }>(
    `/api/split-rooms/${roomId}/members/${memberId}`,
    {
      method: "DELETE",
    },
  );
}

export async function deleteSplitRoom(roomId: string) {
  return apiFetch<{ message: string }>(`/api/split-rooms/${roomId}`, {
    method: "DELETE",
  });
}

export async function finalizeSplitRoom(roomId: string) {
  return apiFetch<{ message: string; finalizedAt: string }>(
    `/api/split-rooms/${roomId}/finalize`,
    { method: "POST" },
  );
}

export async function archiveSplitRoom(roomId: string) {
  return apiFetch<{ message: string; archivedAt: string }>(
    `/api/split-rooms/${roomId}/archive`,
    { method: "POST" },
  );
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

// wallet api
export type WalletTopUpMethod = "UPI" | "Card" | "Net banking";

export type WalletTopUpItem = {
  id: string;
  amount: number;
  method: string;
  createdAt: string;
  displayDate?: string;
};

export type WalletTopUpsResponse = {
  topUps: WalletTopUpItem[];
};

export type WalletTransactionItem = {
  id: string;
  type: "credit" | "debit" | string;
  amount: number;
  description: string | null;
  createdAt: string;
  displayDate?: string;
};

export type PendingWalletSettlement = {
  id: string;
  amount: number;
  status: string;
  direction: "incoming" | "outgoing";
  title?: string;
  roomName?: string;
  fromName: string | null;
  fromEmail: string;
  toName: string | null;
  toEmail: string;
  createdAt: string;
  displayDate?: string;
};

export type WalletSummaryResponse = {
  summary: {
    availableBalance: number;
    pendingIncoming: number;
    pendingOutgoing: number;
    netPosition: number;
  };
  recentWalletTransactions: WalletTransactionItem[];
  pendingSettlements: PendingWalletSettlement[];
};

export async function getWalletSummary() {
  return apiFetch<WalletSummaryResponse>("/api/wallet/summary");
}

export async function getRecentWalletTopUps() {
  return apiFetch<WalletTopUpsResponse>("/api/wallet/top-ups");
}

// razorpay api
export type WalletOrderResponse = {
  order: {
    id: string;
    amount: number;
    currency: "INR";
    receipt?: string;
  };
  keyId?: string;
};

export type RazorpayWalletOrderResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: {
    name?: string;
    email?: string;
  };
};

export async function createRazorpayWalletOrder(payload: {
  amount: number;
  method?: WalletTopUpMethod;
}) {
  return apiFetch<RazorpayWalletOrderResponse>(
    "/api/payments/razorpay/wallet-order",
    {
      method: "POST",
      body: JSON.stringify({
        amount: payload.amount,
        method: payload.method ?? "UPI",
        currency: "INR",
      }),
    },
  );
}

export async function verifyRazorpayWalletPayment(payload: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  return apiFetch<{ message: string; walletBalance: number }>(
    "/api/payments/razorpay/verify-wallet-payment",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

// auth OTP and settings API
export type EmailLoginOtpSession = {
  sessionId: string;
  email: string;
  expiresAt: string;
};

export async function requestEmailLoginOtp(
  email: string,
  password: string,
) {
  return publicApiFetch<EmailLoginOtpSession>(
    "/api/auth/email-login-otp/request",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
  );
}

export async function resendEmailLoginOtp(sessionId: string) {
  return publicApiFetch<EmailLoginOtpSession>(
    "/api/auth/email-login-otp/resend",
    {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    },
  );
}

export async function verifyEmailLoginOtp(sessionId: string, otp: string) {
  return publicApiFetch<{
    verified: boolean;
    customToken: string;
    email: string;
  }>("/api/auth/email-login-otp/verify", {
    method: "POST",
    body: JSON.stringify({ sessionId, otp }),
  });
}

export async function requestPasswordResetOtp(email: string) {
  return publicApiFetch<{ message: string; expiresInSeconds: number }>(
    "/api/auth/password-reset/request",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export type ResetPasswordWithOtpPayload = {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
};

export async function resetPasswordWithOtp(
  payload: ResetPasswordWithOtpPayload,
) {
  return publicApiFetch<{ message: string }>(
    "/api/auth/password-reset/confirm",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export type UpdateProfileSettingsPayload = {
  avatarMode?: "photo" | "initials";
  profilePhotoUrl?: string | null;
  appCurrency?: string;
  appLanguage?: string;
};

export async function updateProfileSettings(payload: UpdateProfileSettingsPayload) {
  return apiFetch<{ message: string; user: DbUser }>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function uploadProfilePhoto(photo: { uri: string; name: string; type: string }) {
  const token = await getAuthToken();
  const formData = new FormData();
  formData.append("photo", photo as unknown as Blob);

  return requestJson<{ message: string; user: DbUser }>(
    "/api/auth/profile-photo",
    {
      method: "POST",
      body: formData,
    },
    token,
  );
}

export type SaveWalletPinPayload = {
  pin: string;
  currentPin?: string;
};

export async function saveWalletPin(payload: SaveWalletPinPayload) {
  return apiFetch<{ message: string; user: DbUser }>("/api/auth/wallet-pin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestWalletPinResetOtp() {
  return apiFetch<{ message: string; expiresInSeconds: number }>(
    "/api/auth/wallet-pin/reset-otp/request",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export type ResetWalletPinWithOtpPayload = {
  otp: string;
  pin: string;
};

export async function resetWalletPinWithOtp(payload: ResetWalletPinWithOtpPayload) {
  return apiFetch<{ message: string; user: DbUser }>(
    "/api/auth/wallet-pin/reset",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteFriend(friendId: string) {
  return apiFetch<{ message: string }>(`/api/friends/${friendId}`, {
    method: "DELETE",
  });
}

export async function deleteAccount(confirmationText: string) {
  return apiFetch<{ message: string }>("/api/auth/account", {
    method: "DELETE",
    body: JSON.stringify({ confirmationText }),
  });
}

export async function downloadMyData() {
  const [
    userResponse,
    dashboard,
    wallet,
    topUps,
    friends,
    splitRooms,
    transactions,
  ] = await Promise.all([
    getCurrentDbUser(),
    getDashboardSummary(),
    getWalletSummary(),
    getRecentWalletTopUps(),
    getFriendsSummary(),
    getSplitRooms(),
    getTransactions({ exportMode: "count", limit: 1000 }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: userResponse.user,
    dashboard,
    wallet,
    walletTopUps: topUps.topUps,
    friends,
    splitRooms: splitRooms.rooms,
    transactions: transactions.transactions,
    transactionSummary: transactions.summary,
  };
}
