import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getExchangeRates } from "../lib/api";
import { translateUiText, type AppLanguageCode } from "../i18n/uiTranslations";
import {
  AppSettingsContext,
  type AppSettingsValue,
  type AvatarId,
  type CurrencyCode,
  type CurrencyFormatOptions,
  type CurrencyOption,
  type ExchangeRatesSource,
  type LanguageOption,
  type NotificationPreferences,
  type WalletTopUpMethod,
} from "./useAppSettings";

const settingsStorageKey = "splitverse-app-settings";

const currencies: CurrencyOption[] = [
  { code: "INR", label: "Indian Rupee", symbol: "₹", rateFromInr: 1, countryHint: "India" },
  { code: "CAD", label: "Canadian Dollar", symbol: "$", rateFromInr: 0.0165, countryHint: "Canada" },
  { code: "USD", label: "US Dollar", symbol: "$", rateFromInr: 0.012, countryHint: "United States" },
  { code: "EUR", label: "Euro", symbol: "€", rateFromInr: 0.011, countryHint: "Europe" },
  { code: "GBP", label: "British Pound", symbol: "£", rateFromInr: 0.0095, countryHint: "United Kingdom" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ", rateFromInr: 0.044, countryHint: "United Arab Emirates" },
  { code: "AUD", label: "Australian Dollar", symbol: "$", rateFromInr: 0.018, countryHint: "Australia" },
  { code: "SGD", label: "Singapore Dollar", symbol: "$", rateFromInr: 0.016, countryHint: "Singapore" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF", rateFromInr: 0.0098, countryHint: "Switzerland" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥", rateFromInr: 1.87, countryHint: "Japan" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥", rateFromInr: 0.086, countryHint: "China" },
];

const languages: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", locale: "en-IN" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", locale: "hi-IN" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা", locale: "bn-IN" },
  { code: "fr", label: "French", nativeLabel: "Français", locale: "fr-FR" },
  { code: "es", label: "Spanish", nativeLabel: "Español", locale: "es-ES" },
  { code: "de", label: "German", nativeLabel: "Deutsch", locale: "de-DE" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", locale: "ar-AE" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", locale: "ja-JP" },
  { code: "zh", label: "Chinese", nativeLabel: "中文", locale: "zh-CN" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", locale: "pt-BR" },
];

const defaultNotificationPreferences: NotificationPreferences = {
  friendRequestEmails: true,
  loginOtpEmails: true,
  settlementReminderEmails: true,
  roomDueNotifications: true,
};

type StoredSettings = Partial<{
  avatarId: AvatarId;
  compactMode: boolean;
  privacyMode: boolean;
  settlementReminders: boolean;
  appCurrency: CurrencyCode;
  appLanguage: AppLanguageCode;
  converterFrom: CurrencyCode;
  converterTo: CurrencyCode;
  converterAmount: number;
  defaultTopUpMethod: WalletTopUpMethod;
  confirmBeforeWalletPayment: boolean;
  notificationPreferences: Partial<NotificationPreferences>;
}>;

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return currencies.some((currency) => currency.code === value);
}

function isAppLanguageCode(value: unknown): value is AppLanguageCode {
  return languages.some((language) => language.code === value);
}

function isAvatarId(value: unknown): value is AvatarId {
  return value === "current" || value === "initials";
}

function isWalletTopUpMethod(value: unknown): value is WalletTopUpMethod {
  return value === "UPI" || value === "Card" || value === "Net banking";
}

function normalizeNotificationPreferences(value: StoredSettings["notificationPreferences"]): NotificationPreferences {
  return { ...defaultNotificationPreferences, ...(value ?? {}) };
}

async function loadStoredSettings(): Promise<StoredSettings> {
  try {
    const stored = await SecureStore.getItemAsync(settingsStorageKey);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

async function saveSettings(settings: StoredSettings) {
  await SecureStore.setItemAsync(settingsStorageKey, JSON.stringify(settings));
}

function getCurrency(currencyCode: CurrencyCode) {
  return currencies.find((currency) => currency.code === currencyCode) ?? currencies[0];
}

function getLanguage(languageCode: AppLanguageCode) {
  return languages.find((language) => language.code === languageCode) ?? languages[0];
}

function getCurrencyFractionDigits(currencyCode: CurrencyCode) {
  return currencyCode === "JPY" || currencyCode === "CNY" ? 0 : 2;
}

function getStaticExchangeRates(): Record<CurrencyCode, number> {
  return currencies.reduce((rates, currency) => ({ ...rates, [currency.code]: currency.rateFromInr }), {} as Record<CurrencyCode, number>);
}

function normalizeExchangeRates(rates: Record<string, number> | undefined): Record<CurrencyCode, number> {
  const nextRates = getStaticExchangeRates();
  nextRates.INR = 1;
  currencies.forEach((currency) => {
    const rate = Number(rates?.[currency.code]);
    if (Number.isFinite(rate) && rate > 0) nextRates[currency.code] = rate;
  });
  return nextRates;
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const detectedCurrency: CurrencyCode = "INR";
  const detectedLanguage: AppLanguageCode = "en";

  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [avatarId, setAvatarIdState] = useState<AvatarId>("current");
  const [compactMode, setCompactModeState] = useState(false);
  const [privacyMode, setPrivacyModeState] = useState(false);
  const [settlementReminders, setSettlementRemindersState] = useState(true);
  const [appCurrency, setAppCurrencyState] = useState<CurrencyCode>(detectedCurrency);
  const [appLanguage, setAppLanguageState] = useState<AppLanguageCode>(detectedLanguage);
  const [converterFrom, setConverterFromState] = useState<CurrencyCode>(detectedCurrency);
  const [converterTo, setConverterToState] = useState<CurrencyCode>("USD");
  const [converterAmount, setConverterAmountState] = useState(1000);
  const [defaultTopUpMethod, setDefaultTopUpMethodState] = useState<WalletTopUpMethod>("UPI");
  const [confirmBeforeWalletPayment, setConfirmBeforeWalletPaymentState] = useState(true);
  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [exchangeRates, setExchangeRates] = useState<Record<CurrencyCode, number>>(() => getStaticExchangeRates());
  const [exchangeRatesSource, setExchangeRatesSource] = useState<ExchangeRatesSource>("fallback");
  const [exchangeRatesFetchedAt, setExchangeRatesFetchedAt] = useState<string | null>(null);
  const [exchangeRatesExpiresAt, setExchangeRatesExpiresAt] = useState<string | null>(null);
  const [exchangeRatesLoading, setExchangeRatesLoading] = useState(true);
  const [exchangeRatesError, setExchangeRatesError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const storedSettings = await loadStoredSettings();
      if (!active) return;
      setAvatarIdState(isAvatarId(storedSettings.avatarId) ? storedSettings.avatarId : "current");
      setCompactModeState(storedSettings.compactMode ?? false);
      setPrivacyModeState(storedSettings.privacyMode ?? false);
      setSettlementRemindersState(storedSettings.settlementReminders ?? true);
      setAppCurrencyState(isCurrencyCode(storedSettings.appCurrency) ? storedSettings.appCurrency : detectedCurrency);
      setAppLanguageState(isAppLanguageCode(storedSettings.appLanguage) ? storedSettings.appLanguage : detectedLanguage);
      setConverterFromState(isCurrencyCode(storedSettings.converterFrom) ? storedSettings.converterFrom : detectedCurrency);
      setConverterToState(isCurrencyCode(storedSettings.converterTo) ? storedSettings.converterTo : "USD");
      setConverterAmountState(storedSettings.converterAmount ?? 1000);
      setDefaultTopUpMethodState(isWalletTopUpMethod(storedSettings.defaultTopUpMethod) ? storedSettings.defaultTopUpMethod : "UPI");
      setConfirmBeforeWalletPaymentState(storedSettings.confirmBeforeWalletPayment ?? true);
      setNotificationPreferencesState(normalizeNotificationPreferences(storedSettings.notificationPreferences));
      setSettingsLoaded(true);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const symbols = currencies.map((currency) => currency.code).filter((currency) => currency !== "INR");
    async function loadExchangeRates() {
      try {
        setExchangeRatesLoading(true);
        setExchangeRatesError("");
        const response = await getExchangeRates("INR", symbols);
        if (!active) return;
        setExchangeRates(normalizeExchangeRates(response.rates));
        setExchangeRatesSource(response.source);
        setExchangeRatesFetchedAt(response.fetchedAt);
        setExchangeRatesExpiresAt(response.expiresAt);
      } catch (error) {
        if (!active) return;
        setExchangeRates(getStaticExchangeRates());
        setExchangeRatesSource("fallback");
        setExchangeRatesFetchedAt(null);
        setExchangeRatesExpiresAt(null);
        setExchangeRatesError(error instanceof Error ? error.message : "Could not load live exchange rates.");
      } finally {
        if (active) setExchangeRatesLoading(false);
      }
    }
    void loadExchangeRates();
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(
    async (updates: StoredSettings) => {
      if (!settingsLoaded) return;
      await saveSettings({
        avatarId,
        compactMode,
        privacyMode,
        settlementReminders,
        appCurrency,
        appLanguage,
        converterFrom,
        converterTo,
        converterAmount,
        defaultTopUpMethod,
        confirmBeforeWalletPayment,
        notificationPreferences,
        ...updates,
      });
    },
    [appCurrency, appLanguage, avatarId, compactMode, confirmBeforeWalletPayment, converterAmount, converterFrom, converterTo, defaultTopUpMethod, notificationPreferences, privacyMode, settlementReminders, settingsLoaded],
  );

  const clearLocalAppSettings = useCallback(async () => {
    await SecureStore.deleteItemAsync(settingsStorageKey);
    setAvatarIdState("current");
    setCompactModeState(false);
    setPrivacyModeState(false);
    setSettlementRemindersState(true);
    setAppCurrencyState(detectedCurrency);
    setAppLanguageState(detectedLanguage);
    setConverterFromState(detectedCurrency);
    setConverterToState("USD");
    setConverterAmountState(1000);
    setDefaultTopUpMethodState("UPI");
    setConfirmBeforeWalletPaymentState(true);
    setNotificationPreferencesState(defaultNotificationPreferences);
  }, []);

  const currenciesWithLiveRates = useMemo<CurrencyOption[]>(() => currencies.map((currency) => ({ ...currency, rateFromInr: exchangeRates[currency.code] ?? currency.rateFromInr })), [exchangeRates]);

  const value = useMemo<AppSettingsValue>(() => {
    const activeLocale = getLanguage(appLanguage).locale;
    function getRateFromInr(currencyCode: CurrencyCode) {
      const fallbackRate = getCurrency(currencyCode).rateFromInr;
      const liveRate = exchangeRates[currencyCode];
      return Number.isFinite(liveRate) && liveRate > 0 ? liveRate : fallbackRate;
    }
    function formatCurrencyValue(amount: number, currency: CurrencyCode, options: CurrencyFormatOptions = {}) {
      if (privacyMode) return "Hidden";
      const numericAmount = Number.isFinite(amount) ? amount : 0;
      const sign = options.signed ? (numericAmount > 0 ? "+" : numericAmount < 0 ? "-" : "") : "";
      const formatter = new Intl.NumberFormat(activeLocale, {
        style: "currency",
        currency,
        notation: options.compact ? "compact" : "standard",
        maximumFractionDigits: getCurrencyFractionDigits(currency),
      });
      return `${sign}${formatter.format(Math.abs(numericAmount))}`;
    }
    function convertCurrency(amount: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode) {
      const sourceRate = getRateFromInr(fromCurrency);
      const targetRate = getRateFromInr(toCurrency);
      if (!sourceRate || !targetRate) return amount;
      return (amount / sourceRate) * targetRate;
    }
    function formatCurrency(amountInInr: number, options: CurrencyFormatOptions = {}) {
      return formatCurrencyValue(convertCurrency(amountInInr, "INR", appCurrency), appCurrency, options);
    }
    function formatDate(dateValue?: string | null, options: Intl.DateTimeFormatOptions = {}) {
      if (!dateValue) return translateUiText("Unknown", appLanguage);
      const rawValue = String(dateValue);
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
        const [year, month, day] = rawValue.split("-");
        return new Intl.DateTimeFormat(activeLocale, { day: "2-digit", month: "short", year: "numeric", ...options }).format(new Date(`${year}-${month}-${day}T00:00:00+05:30`));
      }
      const normalizedValue = rawValue.replace(" ", "T");
      const hasTimezone = /z$|[+-]\d{2}:?\d{2}$/i.test(normalizedValue);
      const date = new Date(hasTimezone ? normalizedValue : `${normalizedValue}Z`);
      if (Number.isNaN(date.getTime())) return translateUiText("Unknown", appLanguage);
      return new Intl.DateTimeFormat(activeLocale, { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata", ...options }).format(date);
    }
    const t = (text: string) => translateUiText(text, appLanguage);
    return {
      avatarId,
      compactMode,
      privacyMode,
      settlementReminders,
      appCurrency,
      detectedCurrency,
      appLanguage,
      converterFrom,
      converterTo,
      converterAmount,
      defaultTopUpMethod,
      confirmBeforeWalletPayment,
      notificationPreferences,
      exchangeRates,
      exchangeRatesSource,
      exchangeRatesFetchedAt,
      exchangeRatesExpiresAt,
      exchangeRatesLoading,
      exchangeRatesError,
      currencies: currenciesWithLiveRates,
      languages,
      setAvatarId(nextAvatarId) {
        setAvatarIdState(nextAvatarId);
        void persist({ avatarId: nextAvatarId });
      },
      setCompactMode(enabled) {
        setCompactModeState(enabled);
        void persist({ compactMode: enabled });
      },
      setPrivacyMode(enabled) {
        setPrivacyModeState(enabled);
        void persist({ privacyMode: enabled });
      },
      setSettlementReminders(enabled) {
        setSettlementRemindersState(enabled);
        void persist({ settlementReminders: enabled });
      },
      setAppCurrency(currency) {
        setAppCurrencyState(currency);
        void persist({ appCurrency: currency });
      },
      setAppLanguage(language) {
        setAppLanguageState(language);
        void persist({ appLanguage: language });
      },
      setConverterFrom(currency) {
        setConverterFromState(currency);
        void persist({ converterFrom: currency });
      },
      setConverterTo(currency) {
        setConverterToState(currency);
        void persist({ converterTo: currency });
      },
      setConverterAmount(amount) {
        setConverterAmountState(amount);
        void persist({ converterAmount: amount });
      },
      setDefaultTopUpMethod(method) {
        setDefaultTopUpMethodState(method);
        void persist({ defaultTopUpMethod: method });
      },
      setConfirmBeforeWalletPayment(enabled) {
        setConfirmBeforeWalletPaymentState(enabled);
        void persist({ confirmBeforeWalletPayment: enabled });
      },
      setNotificationPreference(key, enabled) {
        const next = { ...notificationPreferences, [key]: enabled };
        setNotificationPreferencesState(next);
        void persist({ notificationPreferences: next });
      },
      clearLocalAppSettings,
      convertCurrency,
      formatCurrency,
      formatCurrencyValue,
      formatDate,
      t,
    };
  }, [appCurrency, appLanguage, avatarId, clearLocalAppSettings, compactMode, confirmBeforeWalletPayment, converterAmount, converterFrom, converterTo, currenciesWithLiveRates, defaultTopUpMethod, detectedCurrency, detectedLanguage, exchangeRates, exchangeRatesError, exchangeRatesExpiresAt, exchangeRatesFetchedAt, exchangeRatesLoading, exchangeRatesSource, notificationPreferences, persist, privacyMode, settlementReminders]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}
