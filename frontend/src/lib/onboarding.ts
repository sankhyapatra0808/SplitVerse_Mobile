const ONBOARDING_VERSION = "v1";

function onboardingKey(userId: string) {
  return `splitverse:onboarding:${ONBOARDING_VERSION}:${userId}`;
}

function featureHintKey(userId: string, hintKey: string) {
  return `splitverse:feature-hint:${ONBOARDING_VERSION}:${userId}:${hintKey}`;
}

export function hasCompletedOnboarding(userId: string) {
  return window.localStorage.getItem(onboardingKey(userId)) === "1";
}

export function markOnboardingCompleted(userId: string) {
  window.localStorage.setItem(onboardingKey(userId), "1");
  window.dispatchEvent(new Event("splitverse:onboarding-complete"));
}

export function hasSeenFeatureHint(userId: string, hintKey: string) {
  return window.localStorage.getItem(featureHintKey(userId, hintKey)) === "1";
}

export function markFeatureHintSeen(userId: string, hintKey: string) {
  window.localStorage.setItem(featureHintKey(userId, hintKey), "1");
}
