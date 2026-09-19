import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_VERSION = "v1";

function onboardingKey(userId: string) {
  return `splitverse:onboarding:${ONBOARDING_VERSION}:${userId}`;
}

function featureHintKey(userId: string, hintKey: string) {
  return `splitverse:feature-hint:${ONBOARDING_VERSION}:${userId}:${hintKey}`;
}

export async function hasCompletedOnboarding(userId: string) {
  return (await AsyncStorage.getItem(onboardingKey(userId))) === "1";
}

export async function markOnboardingCompleted(userId: string) {
  await AsyncStorage.setItem(onboardingKey(userId), "1");
}

export async function hasSeenFeatureHint(userId: string, hintKey: string) {
  return (await AsyncStorage.getItem(featureHintKey(userId, hintKey))) === "1";
}

export async function markFeatureHintSeen(userId: string, hintKey: string) {
  await AsyncStorage.setItem(featureHintKey(userId, hintKey), "1");
}
