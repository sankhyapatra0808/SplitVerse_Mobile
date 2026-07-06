import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_ACTIVE_KEY = "splitverse:last-active-at";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function touchSessionActivity() {
  await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

export async function clearSessionActivity() {
  await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
}

export async function isSessionExpired() {
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