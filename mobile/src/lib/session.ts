import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_ACTIVE_KEY = "splitverse:last-active-at";
const REMEMBER_SESSION_KEY = "splitverse:remember-session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let sessionStartedInThisProcess = false;

export async function setRememberSession(remember: boolean) {
  sessionStartedInThisProcess = true;
  await AsyncStorage.setItem(REMEMBER_SESSION_KEY, remember ? "true" : "false");
}

export async function clearRememberSession() {
  sessionStartedInThisProcess = false;
  await AsyncStorage.removeItem(REMEMBER_SESSION_KEY);
}

export async function touchSessionActivity() {
  await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

export async function clearSessionActivity() {
  await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
}

export async function isSessionExpired() {
  const rememberValue = await AsyncStorage.getItem(REMEMBER_SESSION_KEY);
  const rememberSession = rememberValue !== "false";

  // This mirrors the website's session-only persistence when Remember me is off.
  // The user stays signed in while this app process remains open, but a fresh app
  // process signs the persisted Firebase user out.
  if (!rememberSession) {
    return !sessionStartedInThisProcess;
  }

  const value = await AsyncStorage.getItem(LAST_ACTIVE_KEY);

  if (!value) {
    return false;
  }

  const lastActiveAt = Number(value);

  if (!Number.isFinite(lastActiveAt)) {
    return false;
  }

  return Date.now() - lastActiveAt > THIRTY_DAYS_MS;
}
