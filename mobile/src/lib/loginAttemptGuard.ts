import AsyncStorage from "@react-native-async-storage/async-storage";

export const MAX_DAILY_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPT_STORAGE_PREFIX = "splitverse-login-attempts";

function getLoginAttemptDay() {
  return new Date().toLocaleDateString("en-CA");
}

function getLoginAttemptKey(email: string) {
  return `${LOGIN_ATTEMPT_STORAGE_PREFIX}:${email.toLowerCase()}:${getLoginAttemptDay()}`;
}

export async function getLoginAttemptCount(email: string) {
  const value = await AsyncStorage.getItem(getLoginAttemptKey(email));
  return Number(value || 0);
}

export async function recordFailedLoginAttempt(email: string) {
  const nextCount = (await getLoginAttemptCount(email)) + 1;
  await AsyncStorage.setItem(getLoginAttemptKey(email), String(nextCount));
  return nextCount;
}

export async function clearLoginAttempts(email: string) {
  await AsyncStorage.removeItem(getLoginAttemptKey(email));
}
