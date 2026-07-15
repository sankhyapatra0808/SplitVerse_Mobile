import * as SecureStore from "expo-secure-store";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getExchangeRates } from "../lib/api";
import { getErrorMessage, showErrorAlert } from "../lib/errors";
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
  type ThemeColors,
  type ThemeMode,
  type WalletTopUpMethod,
} from "./useAppSettings";

const settingsStorageKey = "splitverse-app-settings";

const lightTheme: ThemeColors = {
  mode: "light",
  primary: "#0052ff",
  primaryActive: "#003ecc",
  primarySoft: "#e8f0ff",
  background: "#f7f7f7",
  canvas: "#ffffff",
  card: "#ffffff",
  surface: "#f7f7f7",
  surfaceStrong: "#eef0f3",
  text: "#0a0b0d",
  body: "#5b616e",
  muted: "#7c828a",
  border: "#dee1e6",
  borderSoft: "#eef0f3",
  onPrimary: "#ffffff",
  success: "#05b169",
  danger: "#cf202f",
  warning: "#f4b000",
  backdrop: "rgba(10, 11, 13, 0.45)",
};

const darkTheme: ThemeColors = {
  mode: "dark",
  primary: "#ff8a1f",
  primaryActive: "#e66f00",
  primarySoft: "rgba(255, 138, 31, 0.16)",
  background: "#050608",
  canvas: "#0b0d10",
  card: "#15171c",
  surface: "#0b0d10",
  surfaceStrong: "#252932",
  text: "#f4f5f7",
  body: "#c2c7d0",
  muted: "#8b929f",
  border: "#2a2f39",
  borderSoft: "#20242c",
  onPrimary: "#111111",
  success: "#24d58a",
  danger: "#ff6875",
  warning: "#ffc857",
  backdrop: "rgba(0, 0, 0, 0.68)",
};

const currencies: CurrencyOption[] = [
  {
    code: "INR",
    label: "Indian Rupee",
    symbol: "₹",
    rateFromInr: 1,
    countryHint: "India",
  },
  {
    code: "CAD",
    label: "Canadian Dollar",
    symbol: "$",
    rateFromInr: 0.0165,
    countryHint: "Canada",
  },
  {
    code: "USD",
    label: "US Dollar",
    symbol: "$",
    rateFromInr: 0.012,
    countryHint: "United States",
  },
  {
    code: "EUR",
    label: "Euro",
    symbol: "€",
    rateFromInr: 0.011,
    countryHint: "Europe",
  },
  {
    code: "GBP",
    label: "British Pound",
    symbol: "£",
    rateFromInr: 0.0095,
    countryHint: "United Kingdom",
  },
  {
    code: "AED",
    label: "UAE Dirham",
    symbol: "د.إ",
    rateFromInr: 0.044,
    countryHint: "United Arab Emirates",
  },
  {
    code: "AUD",
    label: "Australian Dollar",
    symbol: "$",
    rateFromInr: 0.018,
    countryHint: "Australia",
  },
  {
    code: "SGD",
    label: "Singapore Dollar",
    symbol: "$",
    rateFromInr: 0.016,
    countryHint: "Singapore",
  },
  {
    code: "CHF",
    label: "Swiss Franc",
    symbol: "CHF",
    rateFromInr: 0.0098,
    countryHint: "Switzerland",
  },
  {
    code: "JPY",
    label: "Japanese Yen",
    symbol: "¥",
    rateFromInr: 1.87,
    countryHint: "Japan",
  },
  {
    code: "CNY",
    label: "Chinese Yuan",
    symbol: "¥",
    rateFromInr: 0.086,
    countryHint: "China",
  },
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
  {
    code: "pt",
    label: "Portuguese",
    nativeLabel: "Português",
    locale: "pt-BR",
  },
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
  darkMode: boolean;
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

function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
}

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

function normalizeNotificationPreferences(
  value: StoredSettings["notificationPreferences"],
): NotificationPreferences {
  return { ...defaultNotificationPreferences, ...(value ?? {}) };
}

async function loadStoredSettings(): Promise<StoredSettings> {
  const stored = await SecureStore.getItemAsync(settingsStorageKey);
  return stored ? JSON.parse(stored) : {};
}

async function saveSettings(settings: StoredSettings) {
  await SecureStore.setItemAsync(settingsStorageKey, JSON.stringify(settings));
}

function getCurrency(currencyCode: CurrencyCode) {
  return (
    currencies.find((currency) => currency.code === currencyCode) ??
    currencies[0]
  );
}

function getLanguage(languageCode: AppLanguageCode) {
  return (
    languages.find((language) => language.code === languageCode) ?? languages[0]
  );
}

function getCurrencyFractionDigits(currencyCode: CurrencyCode) {
  return currencyCode === "JPY" || currencyCode === "CNY" ? 0 : 2;
}

function getStaticExchangeRates(): Record<CurrencyCode, number> {
  return currencies.reduce(
    (rates, currency) => ({ ...rates, [currency.code]: currency.rateFromInr }),
    {} as Record<CurrencyCode, number>,
  );
}

function normalizeExchangeRates(
  rates: Record<string, number> | undefined,
): Record<CurrencyCode, number> {
  const nextRates = getStaticExchangeRates();
  nextRates.INR = 1;
  currencies.forEach((currency) => {
    const rate = Number(rates?.[currency.code]);
    if (Number.isFinite(rate) && rate > 0) nextRates[currency.code] = rate;
  });
  return nextRates;
}

function dateLooksUsable(date: Date) {
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  return (
    !Number.isNaN(date.getTime()) && year >= 2020 && year <= currentYear + 1
  );
}

function parseAppDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00+05:30`);
    return dateLooksUsable(date) ? date : null;
  }

  const dmy = raw.match(
    /^(\d{1,2})[-\s/]([A-Za-z]{3,}|\d{1,2})[-\s/](\d{2,4})(?:[,\s]+(\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm)?))?$/,
  );
  if (dmy) {
    const monthNames: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };
    const day = Number(dmy[1]);
    const monthToken = dmy[2].toLowerCase();
    const month = /^\d+$/.test(monthToken)
      ? Number(monthToken) - 1
      : monthNames[monthToken];
    let year = Number(dmy[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (
      Number.isInteger(day) &&
      Number.isInteger(month) &&
      Number.isInteger(year)
    ) {
      const date = new Date(Date.UTC(year, month, day));
      if (dateLooksUsable(date)) return date;
    }
  }

  const normalized = raw.replace(" ", "T");
  const hasTimezone = /z$|[+-]\d{2}:?\d{2}$/i.test(normalized);
  const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`);
  return dateLooksUsable(parsed) ? parsed : null;
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const detectedCurrency: CurrencyCode = "INR";
  const detectedLanguage: AppLanguageCode = "en";
  const timeZone = getDeviceTimeZone();

  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [avatarId, setAvatarIdState] = useState<AvatarId>("current");
  const [compactMode, setCompactModeState] = useState(false);
  const [privacyMode, setPrivacyModeState] = useState(false);
  const defaultDarkMode = true;
  const [darkMode, setDarkModeState] = useState(defaultDarkMode);
  const [settlementReminders, setSettlementRemindersState] = useState(true);
  const [appCurrency, setAppCurrencyState] =
    useState<CurrencyCode>(detectedCurrency);
  const [appLanguage, setAppLanguageState] =
    useState<AppLanguageCode>(detectedLanguage);
  const [converterFrom, setConverterFromState] =
    useState<CurrencyCode>(detectedCurrency);
  const [converterTo, setConverterToState] = useState<CurrencyCode>("USD");
  const [converterAmount, setConverterAmountState] = useState(1000);
  const [defaultTopUpMethod, setDefaultTopUpMethodState] =
    useState<WalletTopUpMethod>("UPI");
  const [confirmBeforeWalletPayment, setConfirmBeforeWalletPaymentState] =
    useState(true);
  const [notificationPreferences, setNotificationPreferencesState] =
    useState<NotificationPreferences>(defaultNotificationPreferences);
  const [exchangeRates, setExchangeRates] = useState<
    Record<CurrencyCode, number>
  >(() => getStaticExchangeRates());
  const [exchangeRatesSource, setExchangeRatesSource] =
    useState<ExchangeRatesSource>("fallback");
  const [exchangeRatesFetchedAt, setExchangeRatesFetchedAt] = useState<
    string | null
  >(null);
  const [exchangeRatesExpiresAt, setExchangeRatesExpiresAt] = useState<
    string | null
  >(null);
  const [exchangeRatesLoading, setExchangeRatesLoading] = useState(true);
  const [exchangeRatesError, setExchangeRatesError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const storedSettings = await loadStoredSettings();
        if (!active) return;
        setAvatarIdState(
          isAvatarId(storedSettings.avatarId)
            ? storedSettings.avatarId
            : "current",
        );
        setCompactModeState(storedSettings.compactMode ?? false);
        setPrivacyModeState(storedSettings.privacyMode ?? false);
        setDarkModeState(storedSettings.darkMode ?? defaultDarkMode);
        setSettlementRemindersState(storedSettings.settlementReminders ?? true);
        setAppCurrencyState(
          isCurrencyCode(storedSettings.appCurrency)
            ? storedSettings.appCurrency
            : detectedCurrency,
        );
        setAppLanguageState(
          isAppLanguageCode(storedSettings.appLanguage)
            ? storedSettings.appLanguage
            : detectedLanguage,
        );
        setConverterFromState(
          isCurrencyCode(storedSettings.converterFrom)
            ? storedSettings.converterFrom
            : detectedCurrency,
        );
        setConverterToState(
          isCurrencyCode(storedSettings.converterTo)
            ? storedSettings.converterTo
            : "USD",
        );
        setConverterAmountState(storedSettings.converterAmount ?? 1000);
        setDefaultTopUpMethodState(
          isWalletTopUpMethod(storedSettings.defaultTopUpMethod)
            ? storedSettings.defaultTopUpMethod
            : "UPI",
        );
        setConfirmBeforeWalletPaymentState(
          storedSettings.confirmBeforeWalletPayment ?? true,
        );
        setNotificationPreferencesState(
          normalizeNotificationPreferences(
            storedSettings.notificationPreferences,
          ),
        );
      } catch (error) {
        if (active) {
          showErrorAlert(error, {
            title: "Could not load saved settings",
            fallbackMessage:
              "SplitVerse could not read settings saved on this device. Default settings will be used for now.",
          });
        }
      } finally {
        if (active) setSettingsLoaded(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const symbols = currencies
      .map((currency) => currency.code)
      .filter((currency) => currency !== "INR");
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
        setExchangeRatesError(
          getErrorMessage(
            error,
            "Live exchange rates could not be loaded. Static fallback rates are being used.",
          ),
        );
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

      try {
        await saveSettings({
          avatarId,
          compactMode,
          privacyMode,
          darkMode,
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
      } catch (error) {
        showErrorAlert(error, {
          title: "Could not save app settings",
          fallbackMessage:
            "This preference could not be stored on your device. Check available storage and try again.",
        });
      }
    },
    [
      appCurrency,
      appLanguage,
      avatarId,
      compactMode,
      confirmBeforeWalletPayment,
      converterAmount,
      converterFrom,
      converterTo,
      darkMode,
      defaultTopUpMethod,
      notificationPreferences,
      privacyMode,
      settlementReminders,
      settingsLoaded,
    ],
  );

  const clearLocalAppSettings = useCallback(async () => {
    await SecureStore.deleteItemAsync(settingsStorageKey);
    setAvatarIdState("current");
    setCompactModeState(false);
    setPrivacyModeState(false);
    setDarkModeState(defaultDarkMode);
    setSettlementRemindersState(true);
    setAppCurrencyState(detectedCurrency);
    setAppLanguageState(detectedLanguage);
    setConverterFromState(detectedCurrency);
    setConverterToState("USD");
    setConverterAmountState(1000);
    setDefaultTopUpMethodState("UPI");
    setConfirmBeforeWalletPaymentState(true);
    setNotificationPreferencesState(defaultNotificationPreferences);
  }, [detectedCurrency, detectedLanguage]);

  const currenciesWithLiveRates = useMemo<CurrencyOption[]>(
    () =>
      currencies.map((currency) => ({
        ...currency,
        rateFromInr: exchangeRates[currency.code] ?? currency.rateFromInr,
      })),
    [exchangeRates],
  );

  const value = useMemo<AppSettingsValue>(() => {
    const activeLocale = getLanguage(appLanguage).locale;
    const themeMode: ThemeMode = darkMode ? "dark" : "light";
    const theme = darkMode ? darkTheme : lightTheme;
    const currencyFormatterCache = new Map<string, Intl.NumberFormat>();
    const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

    function getCurrencyFormatter(currency: CurrencyCode, compact: boolean) {
      const cacheKey = `${activeLocale}:${currency}:${compact ? "compact" : "standard"}`;
      const cachedFormatter = currencyFormatterCache.get(cacheKey);

      if (cachedFormatter) {
        return cachedFormatter;
      }

      const formatter = new Intl.NumberFormat(activeLocale, {
        style: "currency",
        currency,
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: getCurrencyFractionDigits(currency),
      });

      currencyFormatterCache.set(cacheKey, formatter);
      return formatter;
    }

    function getDateFormatter(options: Intl.DateTimeFormatOptions) {
      const cacheKey = JSON.stringify(options);
      const cachedFormatter = dateFormatterCache.get(cacheKey);

      if (cachedFormatter) {
        return cachedFormatter;
      }

      const formatter = new Intl.DateTimeFormat(activeLocale, options);
      dateFormatterCache.set(cacheKey, formatter);
      return formatter;
    }

    function getRateFromInr(currencyCode: CurrencyCode) {
      const fallbackRate = getCurrency(currencyCode).rateFromInr;
      const liveRate = exchangeRates[currencyCode];
      return Number.isFinite(liveRate) && liveRate > 0
        ? liveRate
        : fallbackRate;
    }

    function formatCurrencyValue(
      amount: number,
      currency: CurrencyCode,
      options: CurrencyFormatOptions = {},
    ) {
      if (privacyMode) return translateUiText("Hidden", appLanguage);
      const numericAmount = Number.isFinite(amount) ? amount : 0;
      const sign = options.signed
        ? numericAmount > 0
          ? "+"
          : numericAmount < 0
            ? "-"
            : ""
        : "";
      const formatter = getCurrencyFormatter(
        currency,
        Boolean(options.compact),
      );
      return `${sign}${formatter.format(Math.abs(numericAmount))}`;
    }

    function convertCurrency(
      amount: number,
      fromCurrency: CurrencyCode,
      toCurrency: CurrencyCode,
    ) {
      const sourceRate = getRateFromInr(fromCurrency);
      const targetRate = getRateFromInr(toCurrency);
      if (!sourceRate || !targetRate) return amount;
      return (amount / sourceRate) * targetRate;
    }

    function formatCurrency(
      amountInInr: number,
      options: CurrencyFormatOptions = {},
    ) {
      return formatCurrencyValue(
        convertCurrency(amountInInr, "INR", appCurrency),
        appCurrency,
        options,
      );
    }

    function formatDate(
      dateValue?: string | null,
      options: Intl.DateTimeFormatOptions = {},
    ) {
      const date = parseAppDate(dateValue) ?? new Date();
      const formatterOptions: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
        ...options,
      };
      return getDateFormatter(formatterOptions).format(date);
    }

    const t = (text: string) => translateUiText(text, appLanguage);

    return {
      avatarId,
      compactMode,
      privacyMode,
      darkMode,
      themeMode,
      theme,
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
      timeZone,
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
      setDarkMode(enabled) {
        setDarkModeState(enabled);
        void persist({ darkMode: enabled });
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
  }, [
    appCurrency,
    appLanguage,
    avatarId,
    clearLocalAppSettings,
    compactMode,
    confirmBeforeWalletPayment,
    converterAmount,
    converterFrom,
    converterTo,
    currenciesWithLiveRates,
    darkMode,
    defaultTopUpMethod,
    detectedCurrency,
    exchangeRates,
    exchangeRatesError,
    exchangeRatesExpiresAt,
    exchangeRatesFetchedAt,
    exchangeRatesLoading,
    exchangeRatesSource,
    notificationPreferences,
    persist,
    privacyMode,
    settlementReminders,
    timeZone,
  ]);

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}
