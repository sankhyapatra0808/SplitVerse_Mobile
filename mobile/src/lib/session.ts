import * as SecureStore from "expo-secure-store";

const LAST_ACTIVE_KEY = "splitverse:last-active-at";
const REMEMBER_SESSION_KEY = "splitverse:remember-session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let sessionStartedInThisProcess = false;

async function writeSecureValue(key: string, value: string) {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function setRememberSession(remember: boolean) {
  sessionStartedInThisProcess = true;
  await writeSecureValue(REMEMBER_SESSION_KEY, remember ? "true" : "false");
}

export async function clearRememberSession() {
  sessionStartedInThisProcess = false;
  await SecureStore.deleteItemAsync(REMEMBER_SESSION_KEY);
}

export async function touchSessionActivity() {
  await writeSecureValue(LAST_ACTIVE_KEY, String(Date.now()));
}

export async function clearSessionActivity() {
  await SecureStore.deleteItemAsync(LAST_ACTIVE_KEY);
}

export async function isSessionExpired() {
  const rememberValue = await SecureStore.getItemAsync(REMEMBER_SESSION_KEY);
  const rememberSession = rememberValue !== "false";

  // When Remember me is off, a fresh app process signs out the persisted
  // Firebase user while the current process remains usable.
  if (!rememberSession) {
    return !sessionStartedInThisProcess;
  }

  const value = await SecureStore.getItemAsync(LAST_ACTIVE_KEY);

  if (!value) {
    return false;
  }

  const lastActiveAt = Number(value);

  if (!Number.isFinite(lastActiveAt)) {
    await clearSessionActivity();
    return true;
  }

  return Date.now() - lastActiveAt > THIRTY_DAYS_MS;
}
