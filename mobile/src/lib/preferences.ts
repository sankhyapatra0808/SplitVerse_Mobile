import * as SecureStore from "expo-secure-store";

const PREFERENCES_KEY = "splitverse_mobile_preferences";

export type AppCurrency = "INR" | "USD" | "EUR" | "GBP";
export type AppLanguage = "English" | "Hindi" | "Bengali";

export type AppPreferences = {
  currency: AppCurrency;
  language: AppLanguage;
  compactMode: boolean;
  privacyMode: boolean;
  walletConfirmation: boolean;
  paymentNotifications: boolean;
  friendRequestNotifications: boolean;
  roomReminderNotifications: boolean;
};

export const defaultPreferences: AppPreferences = {
  currency: "INR",
  language: "English",
  compactMode: false,
  privacyMode: true,
  walletConfirmation: true,
  paymentNotifications: true,
  friendRequestNotifications: true,
  roomReminderNotifications: true,
};

export async function loadPreferences(): Promise<AppPreferences> {
  const stored = await SecureStore.getItemAsync(PREFERENCES_KEY);

  if (!stored) {
    return defaultPreferences;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<AppPreferences>;

    return {
      ...defaultPreferences,
      ...parsed,
    };
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(preferences: AppPreferences) {
  await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(preferences));
}

export async function resetPreferences() {
  await SecureStore.deleteItemAsync(PREFERENCES_KEY);
}
