import { Alert } from "react-native";

export type AppErrorCode =
  | "NO_INTERNET"
  | "SLOW_INTERNET"
  | "SERVER_UNREACHABLE"
  | "SERVER_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "AUTH_REQUIRED"
  | "SESSION_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_IN_USE"
  | "INVALID_EMAIL"
  | "WEAK_PASSWORD"
  | "ACCOUNT_DISABLED"
  | "TOO_MANY_ATTEMPTS"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "PAYMENT_CANCELLED"
  | "PAYMENT_FAILED"
  | "GOOGLE_SIGN_IN_CANCELLED"
  | "GOOGLE_PLAY_SERVICES"
  | "PHOTO_PERMISSION"
  | "FILE_TOO_LARGE"
  | "SHARING_UNAVAILABLE"
  | "STORAGE_FULL"
  | "STORAGE_ERROR"
  | "INVALID_FILE"
  | "CONFIGURATION_ERROR"
  | "CANCELLED"
  | "UNKNOWN";

export type AppErrorContext = {
  title?: string;
  fallbackMessage?: string;
  action?: string;
};

export type AppErrorOptions = {
  code: AppErrorCode;
  title: string;
  message: string;
  status?: number;
  retryable?: boolean;
  originalError?: unknown;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly title: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly originalError?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.title = options.title;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.originalError = options.originalError;
  }
}

const NETWORK_FAILURE_PATTERNS = [
  "network request failed",
  "failed to fetch",
  "network error",
  "networkerror",
  "unable to resolve host",
  "internet connection appears to be offline",
  "socket hang up",
  "connection reset",
  "connection refused",
  "dns",
];

const TIMEOUT_PATTERNS = [
  "timed out",
  "timeout",
  "time out",
  "etimedout",
  "econnaborted",
];

const CONNECTIVITY_URLS = [
  "https://clients3.google.com/generate_204",
  "https://www.cloudflare.com/cdn-cgi/trace",
];

let connectivityCheckPromise: Promise<boolean> | null = null;

function getUnknownRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getRawCode(error: unknown) {
  const record = getUnknownRecord(error);
  return readString(record?.code ?? record?.errorCode ?? record?.statusCode);
}

function getRawMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message.trim();

  const record = getUnknownRecord(error);
  return readString(
    record?.message ??
      record?.description ??
      record?.reason ??
      record?.error_description ??
      record?.error,
  );
}

function includesAny(value: string, patterns: string[]) {
  const normalized = value.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function isAbortError(error: unknown) {
  const record = getUnknownRecord(error);
  return (
    (error instanceof Error && error.name === "AbortError") ||
    readString(record?.name).toLowerCase() === "aborterror"
  );
}

function getContextMessage(context?: AppErrorContext) {
  if (context?.fallbackMessage) return context.fallbackMessage;
  if (context?.action) return `SplitVerse could not finish ${context.action}. Please try again.`;
  return "Something went wrong. Please try again.";
}

function createContextError(
  code: AppErrorCode,
  title: string,
  message: string,
  error: unknown,
  retryable = false,
  status?: number,
) {
  return new AppError({
    code,
    title,
    message,
    retryable,
    status,
    originalError: error,
  });
}

async function runConnectivityCheck() {
  for (const url of CONNECTIVITY_URLS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.ok || response.status === 204) return true;
    } catch {
      // Try the next lightweight connectivity endpoint.
    } finally {
      clearTimeout(timeout);
    }
  }

  return false;
}

export async function hasInternetConnection() {
  if (!connectivityCheckPromise) {
    connectivityCheckPromise = runConnectivityCheck().finally(() => {
      connectivityCheckPromise = null;
    });
  }

  return connectivityCheckPromise;
}

export async function createFetchFailureError(
  error: unknown,
  options?: { timedOut?: boolean; action?: string },
) {
  const rawCode = getRawCode(error).toLowerCase();
  const rawMessage = getRawMessage(error);
  const timedOut =
    options?.timedOut ||
    isAbortError(error) ||
    includesAny(`${rawCode} ${rawMessage}`, TIMEOUT_PATTERNS);

  if (timedOut) {
    const online = await hasInternetConnection();

    if (!online) {
      return createContextError(
        "NO_INTERNET",
        "No internet connection",
        "Your device appears to be offline. Reconnect to Wi-Fi or mobile data, then try again.",
        error,
        true,
      );
    }

    return createContextError(
      "SLOW_INTERNET",
      "Slow internet connection",
      `The connection is taking too long${options?.action ? ` while ${options.action}` : ""}. Check your network speed and try again.`,
      error,
      true,
    );
  }

  const online = await hasInternetConnection();

  if (!online) {
    return createContextError(
      "NO_INTERNET",
      "No internet connection",
      "Your device appears to be offline. Reconnect to Wi-Fi or mobile data, then try again.",
      error,
      true,
    );
  }

  return createContextError(
    "SERVER_UNREACHABLE",
    "Cannot reach SplitVerse",
    "Your internet is working, but the SplitVerse server cannot be reached right now. Please try again shortly.",
    error,
    true,
  );
}

function getServerMessage(data: unknown) {
  const record = getUnknownRecord(data);
  return readString(record?.message ?? record?.error ?? record?.detail);
}

function getServerCode(data: unknown) {
  const record = getUnknownRecord(data);
  return readString(record?.code ?? record?.errorCode).toLowerCase();
}

function getSpecificServerTitle(message: string, code: string) {
  const value = `${code} ${message}`.toLowerCase();

  if (value.includes("otp") && value.includes("expired")) return "Code expired";
  if (value.includes("otp") && (value.includes("invalid") || value.includes("incorrect"))) {
    return "Incorrect verification code";
  }
  if (value.includes("wallet pin") && (value.includes("invalid") || value.includes("incorrect"))) {
    return "Incorrect wallet PIN";
  }
  if (value.includes("insufficient") && (value.includes("balance") || value.includes("fund"))) {
    return "Insufficient wallet balance";
  }
  if (value.includes("already friend") || value.includes("already connected")) return "Already friends";
  if (value.includes("friend request") && value.includes("already")) return "Request already sent";
  if (value.includes("yourself") || value.includes("own email")) return "Cannot add yourself";
  if (value.includes("email") && value.includes("already") && value.includes("use")) {
    return "Email already registered";
  }
  if (value.includes("room") && (value.includes("finalized") || value.includes("closed"))) {
    return "Room is closed";
  }
  if (value.includes("owner") || value.includes("host")) return "Host access required";
  if (value.includes("outstanding") || value.includes("pending dues")) return "Pending dues remain";
  if (value.includes("not enough") && value.includes("member")) return "More members required";
  if (value.includes("file") && value.includes("large")) return "File too large";
  if (value.includes("unsupported") && (value.includes("file") || value.includes("image"))) {
    return "Unsupported file type";
  }
  if (value.includes("payment") && value.includes("cancel")) return "Payment cancelled";
  if (value.includes("payment") && value.includes("failed")) return "Payment failed";
  if (value.includes("session") && value.includes("expired")) return "Session expired";

  return "";
}

function getResourceName(path: string) {
  if (path.includes("dashboard")) return "Dashboard data";
  if (path.includes("friends")) return "Friend data";
  if (path.includes("split-rooms")) return "Split room";
  if (path.includes("wallet")) return "Wallet data";
  if (path.includes("transactions")) return "Transaction data";
  if (path.includes("expenses")) return "Expense";
  if (path.includes("profile")) return "Profile";
  if (path.includes("exchange-rates")) return "Exchange-rate service";
  return "Requested information";
}

export function createHttpError(
  status: number,
  data: unknown,
  path = "",
  originalError?: unknown,
) {
  const serverMessage = getServerMessage(data);
  const serverCode = getServerCode(data);
  const specificTitle = getSpecificServerTitle(serverMessage, serverCode);
  const resource = getResourceName(path);

  if (status === 400 || status === 422) {
    return createContextError(
      "VALIDATION_ERROR",
      specificTitle || "Check your details",
      serverMessage || "Some information is missing or invalid. Check the entered details and try again.",
      originalError ?? data,
      false,
      status,
    );
  }

  if (status === 401) {
    const otpRelated = `${serverCode} ${serverMessage}`.toLowerCase().includes("otp");
    return createContextError(
      otpRelated ? "VALIDATION_ERROR" : "SESSION_EXPIRED",
      specificTitle || (otpRelated ? "Verification failed" : "Session expired"),
      serverMessage ||
        (otpRelated
          ? "The verification code is invalid or has expired. Request a new code and try again."
          : "Your sign-in session has expired. Sign in again to continue."),
      originalError ?? data,
      !otpRelated,
      status,
    );
  }

  if (status === 403) {
    return createContextError(
      "PERMISSION_DENIED",
      specificTitle || "Permission denied",
      serverMessage || "You do not have permission to perform this action.",
      originalError ?? data,
      false,
      status,
    );
  }

  if (status === 404) {
    return createContextError(
      "NOT_FOUND",
      specificTitle || `${resource} not found`,
      serverMessage || `${resource} could not be found. It may have been removed or changed.`,
      originalError ?? data,
      false,
      status,
    );
  }

  if (status === 409) {
    return createContextError(
      "CONFLICT",
      specificTitle || "Already updated",
      serverMessage || "This action conflicts with the latest data. Refresh the page and try again.",
      originalError ?? data,
      true,
      status,
    );
  }

  if (status === 413) {
    return createContextError(
      "FILE_TOO_LARGE",
      "File too large",
      serverMessage || "The selected file is too large to upload. Choose a smaller file and try again.",
      originalError ?? data,
      false,
      status,
    );
  }

  if (status === 429) {
    return createContextError(
      "TOO_MANY_ATTEMPTS",
      "Too many attempts",
      serverMessage || "Too many requests were made in a short time. Wait a minute, then try again.",
      originalError ?? data,
      true,
      status,
    );
  }

  if (status === 502 || status === 503) {
    return createContextError(
      "SERVICE_UNAVAILABLE",
      "Service temporarily unavailable",
      "SplitVerse is temporarily unavailable or under maintenance. Please try again shortly.",
      originalError ?? data,
      true,
      status,
    );
  }

  if (status === 504) {
    return createContextError(
      "SLOW_INTERNET",
      "Request timed out",
      "The server took too long to respond. Check your connection and try again.",
      originalError ?? data,
      true,
      status,
    );
  }

  if (status >= 500) {
    return createContextError(
      "SERVER_ERROR",
      "SplitVerse server error",
      "The server ran into a problem while processing your request. Your data was not intentionally changed. Please try again shortly.",
      originalError ?? data,
      true,
      status,
    );
  }

  return createContextError(
    "UNKNOWN",
    specificTitle || "Request failed",
    serverMessage || "The request could not be completed. Please try again.",
    originalError ?? data,
    true,
    status,
  );
}

export function normalizeAppError(
  error: unknown,
  context?: AppErrorContext,
): AppError {
  if (error instanceof AppError) return error;

  const rawCode = getRawCode(error);
  const code = rawCode.toLowerCase();
  const rawMessage = getRawMessage(error);
  const combined = `${code} ${rawMessage}`.toLowerCase();

  if (isAbortError(error) || includesAny(combined, TIMEOUT_PATTERNS)) {
    return createContextError(
      "SLOW_INTERNET",
      "Slow internet connection",
      "The request took too long. Check your network speed and try again.",
      error,
      true,
    );
  }

  if (
    code === "auth/network-request-failed" ||
    code === "network_error" ||
    code === "err_network" ||
    includesAny(combined, NETWORK_FAILURE_PATTERNS)
  ) {
    return createContextError(
      "NO_INTERNET",
      "No internet connection",
      "Your device could not connect to the internet. Reconnect to Wi-Fi or mobile data, then try again.",
      error,
      true,
    );
  }

  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-login-credentials"
  ) {
    return createContextError(
      "INVALID_CREDENTIALS",
      "Incorrect email or password",
      "The email or password is incorrect. Check both fields and try again.",
      error,
    );
  }

  if (code === "auth/missing-email" || code === "auth/missing-password") {
    return createContextError(
      "VALIDATION_ERROR",
      "Email and password required",
      "Enter both your email address and password before continuing.",
      error,
    );
  }

  if (code === "auth/invalid-verification-code") {
    return createContextError(
      "VALIDATION_ERROR",
      "Incorrect verification code",
      "The verification code is incorrect. Check the 6 digits and try again.",
      error,
    );
  }

  if (code === "auth/code-expired") {
    return createContextError(
      "VALIDATION_ERROR",
      "Verification code expired",
      "This verification code has expired. Request a new code and try again.",
      error,
    );
  }

  if (code === "auth/user-token-expired" || code === "auth/id-token-expired") {
    return createContextError(
      "SESSION_EXPIRED",
      "Session expired",
      "Your secure sign-in session has expired. Sign in again to continue.",
      error,
      true,
    );
  }

  if (code === "auth/email-already-in-use") {
    return createContextError(
      "EMAIL_IN_USE",
      "Email already registered",
      "An account already exists with this email. Sign in instead or use another email address.",
      error,
    );
  }

  if (code === "auth/invalid-email") {
    return createContextError(
      "INVALID_EMAIL",
      "Invalid email address",
      "Enter a complete email address in the correct format, such as name@example.com.",
      error,
    );
  }

  if (code === "auth/weak-password") {
    return createContextError(
      "WEAK_PASSWORD",
      "Password is too weak",
      "Use a stronger password with at least 10 characters. A mix of letters, numbers, and symbols is safer.",
      error,
    );
  }

  if (code === "auth/user-disabled") {
    return createContextError(
      "ACCOUNT_DISABLED",
      "Account disabled",
      "This account has been disabled. Contact SplitVerse support for help.",
      error,
    );
  }

  if (code === "auth/too-many-requests" || combined.includes("too many requests")) {
    return createContextError(
      "TOO_MANY_ATTEMPTS",
      "Too many attempts",
      "Access has been temporarily limited after repeated attempts. Wait a few minutes, then try again.",
      error,
      true,
    );
  }

  if (code === "auth/requires-recent-login") {
    return createContextError(
      "SESSION_EXPIRED",
      "Sign in again required",
      "For security, sign out and sign in again before making this sensitive change.",
      error,
    );
  }

  if (
    code === "auth/invalid-api-key" ||
    code === "auth/app-not-authorized" ||
    code === "auth/invalid-app-credential"
  ) {
    return createContextError(
      "CONFIGURATION_ERROR",
      "Firebase configuration error",
      "This app build is not authorized to use the configured Firebase project. Check the Firebase keys and Android app registration.",
      error,
    );
  }

  if (code === "auth/quota-exceeded") {
    return createContextError(
      "SERVICE_UNAVAILABLE",
      "Authentication service limit reached",
      "The sign-in service has reached a temporary usage limit. Please try again later.",
      error,
      true,
    );
  }

  if (code === "auth/operation-not-allowed") {
    return createContextError(
      "CONFIGURATION_ERROR",
      "Sign-in method unavailable",
      "This sign-in method is not enabled for SplitVerse. Use another sign-in option or contact support.",
      error,
    );
  }

  if (code === "auth/account-exists-with-different-credential") {
    return createContextError(
      "CONFLICT",
      "Account uses another sign-in method",
      "This email is already linked to another sign-in method. Sign in using the original method first.",
      error,
    );
  }

  if (code === "auth/credential-already-in-use") {
    return createContextError(
      "CONFLICT",
      "Google account already linked",
      "This Google account is already connected to another SplitVerse account.",
      error,
    );
  }

  if (
    code.includes("sign_in_cancelled") ||
    code === "12501" ||
    combined.includes("sign in cancelled") ||
    combined.includes("sign-in cancelled")
  ) {
    return createContextError(
      "GOOGLE_SIGN_IN_CANCELLED",
      "Google sign-in cancelled",
      "Google sign-in was closed before it finished. Start again when you are ready.",
      error,
    );
  }

  if (code.includes("play_services_not_available") || combined.includes("play services")) {
    return createContextError(
      "GOOGLE_PLAY_SERVICES",
      "Google Play services unavailable",
      "Update or enable Google Play services on this device, then try Google sign-in again.",
      error,
    );
  }

  if (code.includes("in_progress")) {
    return createContextError(
      "CONFLICT",
      "Google sign-in already open",
      "A Google sign-in request is already in progress. Complete or close it before trying again.",
      error,
    );
  }

  if (code.includes("developer_error") || combined.includes("web client id") || combined.includes("sha-1")) {
    return createContextError(
      "CONFIGURATION_ERROR",
      "Google sign-in configuration error",
      "Google sign-in is not configured correctly for this app build. Check the Web client ID and Android SHA fingerprints.",
      error,
    );
  }

  if (
    combined.includes("payment") &&
    (combined.includes("cancel") || code === "0" || code.includes("payment_cancel"))
  ) {
    return createContextError(
      "PAYMENT_CANCELLED",
      "Payment cancelled",
      "The payment window was closed before the top-up was completed. No money was added to your wallet.",
      error,
    );
  }

  if (combined.includes("payment") || combined.includes("razorpay")) {
    return createContextError(
      "PAYMENT_FAILED",
      "Payment failed",
      rawMessage || "The payment could not be completed. Check your payment method and try again.",
      error,
      true,
    );
  }

  if (combined.includes("permission") && (combined.includes("photo") || combined.includes("media"))) {
    return createContextError(
      "PHOTO_PERMISSION",
      "Photo access required",
      "Allow SplitVerse to access photos in your device settings, then try again.",
      error,
    );
  }

  if (combined.includes("sharing is not available") || combined.includes("share is not available")) {
    return createContextError(
      "SHARING_UNAVAILABLE",
      "Sharing unavailable",
      "This device cannot open the system sharing window. The export could not be shared from the app.",
      error,
    );
  }

  if (combined.includes("enospc") || combined.includes("no space left") || combined.includes("storage full")) {
    return createContextError(
      "STORAGE_FULL",
      "Device storage is full",
      "Free some storage space on your device, then try creating the file again.",
      error,
    );
  }

  if (
    combined.includes("securestore") ||
    combined.includes("secure store") ||
    combined.includes("keystore") ||
    combined.includes("keychain")
  ) {
    return createContextError(
      "STORAGE_ERROR",
      "Secure storage unavailable",
      "SplitVerse could not access secure storage on this device. Restart the app and make sure device storage is available.",
      error,
      true,
    );
  }

  if (
    combined.includes("eacces") ||
    combined.includes("permission denied") ||
    combined.includes("not permitted")
  ) {
    return createContextError(
      "PERMISSION_DENIED",
      "Device permission denied",
      "SplitVerse does not have permission to access the required file or device feature. Check app permissions and try again.",
      error,
    );
  }

  if (
    combined.includes("unexpected token") ||
    combined.includes("json parse") ||
    combined.includes("malformed json")
  ) {
    return createContextError(
      "INVALID_RESPONSE",
      "Saved data is unreadable",
      "Some saved app data could not be read. SplitVerse will use safe defaults where possible.",
      error,
    );
  }

  if (combined.includes("expo_public_") && combined.includes("missing")) {
    return createContextError(
      "CONFIGURATION_ERROR",
      "App configuration missing",
      "This app build is missing a required environment setting. Add the missing value and rebuild the app.",
      error,
    );
  }

  if (rawMessage) {
    return createContextError(
      "UNKNOWN",
      context?.title || "Something went wrong",
      rawMessage,
      error,
      true,
    );
  }

  return createContextError(
    "UNKNOWN",
    context?.title || "Something went wrong",
    getContextMessage(context),
    error,
    true,
  );
}

export function getErrorPresentation(
  error: unknown,
  context?: AppErrorContext,
) {
  const appError = normalizeAppError(error, context);
  return {
    title: appError.title || context?.title || "Something went wrong",
    message: appError.message || getContextMessage(context),
    code: appError.code,
    retryable: appError.retryable,
  };
}

export function getErrorMessage(
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again.",
) {
  return getErrorPresentation(error, { fallbackMessage }).message;
}

export function showErrorAlert(
  error: unknown,
  context?: AppErrorContext,
) {
  const presentation = getErrorPresentation(error, context);
  Alert.alert(presentation.title, presentation.message);
  return presentation;
}
