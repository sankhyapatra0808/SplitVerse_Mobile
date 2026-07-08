import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, View } from "react-native";
import AppButton from "../../src/components/AppButton";
import AppCard from "../../src/components/AppCard";
import AppTextInput from "../../src/components/AppTextInput";
import Avatar from "../../src/components/Avatar";
import EmptyState from "../../src/components/EmptyState";
import LoadingState from "../../src/components/LoadingState";
import Screen from "../../src/components/Screen";
import SheetModal from "../../src/components/SheetModal";
import Text from "../../src/components/LocalizedText";
import { useAuth } from "../../src/context/AuthContext";
import {
  useAppSettings,
  type AppLanguageCode,
  type CurrencyCode,
  type WalletTopUpMethod,
} from "../../src/context/useAppSettings";
import {
  deleteAccount,
  deleteFriend,
  downloadMyData,
  getFriendsSummary,
  requestWalletPinResetOtp,
  resetWalletPinWithOtp,
  saveWalletPin,
  updateProfileSettings,
  uploadProfilePhoto,
  type Friend,
} from "../../src/lib/api";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";

const deleteAccountConfirmationText = "/DeleteAccount";
const topUpMethods: WalletTopUpMethod[] = ["UPI", "Card", "Net banking"];

function normalizePinInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function getWalletPinStrengthError(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) return "Wallet PIN must be 4 to 6 digits.";
  if (/^(\d)\1+$/.test(pin))
    return "Use a stronger PIN. Repeated digits are too easy to guess.";
  if (
    [
      "1234",
      "4321",
      "12345",
      "54321",
      "123456",
      "654321",
      "0000",
      "1111",
      "9999",
    ].includes(pin)
  )
    return "Use a stronger PIN.";
  return "";
}

function getFriendLabel(friend: Friend) {
  return friend.name || friend.email.split("@")[0] || friend.email;
}

function formatFriendshipAge(days?: number) {
  const value = Number(days || 0);
  if (value <= 0) return "Friends today";
  if (value === 1) return "Friends for 1 day";
  return `Friends for ${value} days`;
}

export default function Settings() {
  const { user, dbUser, logout, refreshDbUser } = useAuth();
  const {
    avatarId,
    appCurrency,
    appLanguage,
    compactMode,
    confirmBeforeWalletPayment,
    converterAmount,
    converterFrom,
    converterTo,
    currencies,
    languages,
    defaultTopUpMethod,
    exchangeRatesError,
    exchangeRatesFetchedAt,
    exchangeRatesLoading,
    exchangeRatesSource,
    formatCurrency,
    formatCurrencyValue,
    convertCurrency,
    formatDate,
    notificationPreferences,
    privacyMode,
    settlementReminders,
    setAppCurrency,
    setAppLanguage,
    setAvatarId,
    setCompactMode,
    setConfirmBeforeWalletPayment,
    setConverterAmount,
    setConverterFrom,
    setConverterTo,
    setDefaultTopUpMethod,
    setNotificationPreference,
    setPrivacyMode,
    setSettlementReminders,
    clearLocalAppSettings,
  } = useAppSettings();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendSearch, setFriendSearch] = useState("");
  const [deletingFriendId, setDeletingFriendId] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [walletPinSet, setWalletPinSet] = useState(
    Boolean(dbUser?.has_wallet_pin),
  );
  const [walletPinCurrent, setWalletPinCurrent] = useState("");
  const [walletPinNew, setWalletPinNew] = useState("");
  const [walletPinConfirm, setWalletPinConfirm] = useState("");
  const [savingWalletPin, setSavingWalletPin] = useState(false);
  const [walletPinResetOpen, setWalletPinResetOpen] = useState(false);
  const [walletPinResetOtp, setWalletPinResetOtp] = useState("");
  const [walletPinResetNew, setWalletPinResetNew] = useState("");
  const [walletPinResetConfirm, setWalletPinResetConfirm] = useState("");
  const [requestingWalletPinReset, setRequestingWalletPinReset] =
    useState(false);
  const [resettingWalletPin, setResettingWalletPin] = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const displayName =
    dbUser?.display_name ||
    dbUser?.name ||
    user?.displayName ||
    "SplitVerse user";
  const email = dbUser?.email || user?.email || "";
  const username = dbUser?.username
    ? `@${dbUser.username}`
    : "Username coming soon";
  const walletBalance = Number(dbUser?.wallet_balance || 0);
  const convertedAmount = convertCurrency(
    converterAmount,
    converterFrom,
    converterTo,
  );

  const visibleFriends = useMemo(() => {
    const search = friendSearch.trim().toLowerCase();
    if (!search) return friends;
    return friends.filter((friend) =>
      `${friend.name ?? ""} ${friend.email}`.toLowerCase().includes(search),
    );
  }, [friendSearch, friends]);

  const exchangeRateStatusText = exchangeRatesLoading
    ? "Loading live exchange rates..."
    : exchangeRatesError
      ? `Using fallback exchange rates. ${exchangeRatesError}`
      : `Rates: ${exchangeRatesSource}${exchangeRatesFetchedAt ? ` · ${formatDate(exchangeRatesFetchedAt, { hour: "2-digit", minute: "2-digit" })}` : ""}`;

  useEffect(() => {
    setWalletPinSet(Boolean(dbUser?.has_wallet_pin));
  }, [dbUser?.has_wallet_pin]);

  useEffect(() => {
    let active = true;
    async function loadFriends() {
      try {
        setFriendsLoading(true);
        const data = await getFriendsSummary();
        if (active) setFriends(data.friends ?? []);
      } catch (error) {
        if (active)
          Alert.alert(
            "Friends failed",
            error instanceof Error ? error.message : "Could not load friends",
          );
      } finally {
        if (active) setFriendsLoading(false);
      }
    }
    void loadFriends();
    return () => {
      active = false;
    };
  }, []);

  async function saveProfileDisplay(
    nextAvatarId = avatarId,
    nextPhotoUrl = profilePhotoUrl.trim(),
  ) {
    try {
      setProfileSaving(true);
      const response = await updateProfileSettings({
        avatarMode: nextAvatarId === "initials" ? "initials" : "photo",
        profilePhotoUrl: nextPhotoUrl || null,
      });
      setAvatarId(nextAvatarId);
      setProfilePhotoUrl("");
      await refreshDbUser();
      Alert.alert(
        "Profile updated",
        response.message || "Profile display updated.",
      );
    } catch (error) {
      Alert.alert(
        "Profile failed",
        error instanceof Error
          ? error.message
          : "Could not update profile display.",
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleAvatarModeChange(useInitials: boolean) {
    const nextAvatarId = useInitials ? "initials" : "current";
    setAvatarId(nextAvatarId);
    await saveProfileDisplay(nextAvatarId, "");
  }

  async function handlePickProfilePhoto() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Allow photo access to upload your profile picture.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setProfileSaving(true);
      const response = await uploadProfilePhoto({
        uri: asset.uri,
        name: asset.fileName || `splitverse-profile-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });
      setAvatarId("current");
      await refreshDbUser();
      Alert.alert(
        "Photo uploaded",
        response.message || "Profile photo updated.",
      );
    } catch (error) {
      Alert.alert(
        "Upload failed",
        error instanceof Error
          ? error.message
          : "Could not upload profile photo.",
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleAppCurrencyChange(currency: CurrencyCode) {
    setAppCurrency(currency);
    try {
      await updateProfileSettings({ appCurrency: currency });
    } catch {
      // Local setting remains available even if backend sync fails.
    }
  }

  async function handleAppLanguageChange(language: AppLanguageCode) {
    setAppLanguage(language);
    try {
      await updateProfileSettings({ appLanguage: language });
    } catch {
      // Local setting remains available even if backend sync fails.
    }
  }

  async function handleSaveWalletPin() {
    const nextPin = walletPinNew.trim();
    const confirmPin = walletPinConfirm.trim();
    const strengthError = getWalletPinStrengthError(nextPin);

    if (strengthError) {
      Alert.alert("Weak PIN", strengthError);
      return;
    }
    if (nextPin !== confirmPin) {
      Alert.alert("PIN mismatch", "Wallet PIN confirmation does not match.");
      return;
    }
    if (walletPinSet && !walletPinCurrent.trim()) {
      Alert.alert(
        "Old PIN required",
        "Enter your current wallet PIN to change it.",
      );
      return;
    }

    try {
      setSavingWalletPin(true);
      const response = await saveWalletPin({
        pin: nextPin,
        currentPin: walletPinCurrent.trim() || undefined,
      });
      setWalletPinSet(Boolean(response.user.has_wallet_pin));
      setWalletPinCurrent("");
      setWalletPinNew("");
      setWalletPinConfirm("");
      await refreshDbUser();
      Alert.alert(
        "Wallet PIN saved",
        response.message || "Wallet PIN changed successfully.",
      );
    } catch (error) {
      Alert.alert(
        "PIN failed",
        error instanceof Error ? error.message : "Could not save wallet PIN.",
      );
    } finally {
      setSavingWalletPin(false);
    }
  }

  async function handleRequestWalletPinResetOtp() {
    try {
      setRequestingWalletPinReset(true);
      const response = await requestWalletPinResetOtp();
      Alert.alert(
        "OTP sent",
        response.message || "Wallet PIN reset code sent to your email.",
      );
    } catch (error) {
      Alert.alert(
        "OTP failed",
        error instanceof Error
          ? error.message
          : "Could not send wallet PIN reset OTP.",
      );
    } finally {
      setRequestingWalletPinReset(false);
    }
  }

  async function handleResetWalletPin() {
    const otp = walletPinResetOtp.trim();
    const nextPin = walletPinResetNew.trim();
    const confirmPin = walletPinResetConfirm.trim();
    const strengthError = getWalletPinStrengthError(nextPin);

    if (otp.length !== 6) {
      Alert.alert("OTP required", "Enter the 6-digit OTP sent to your email.");
      return;
    }
    if (strengthError) {
      Alert.alert("Weak PIN", strengthError);
      return;
    }
    if (nextPin !== confirmPin) {
      Alert.alert("PIN mismatch", "Wallet PIN confirmation does not match.");
      return;
    }

    try {
      setResettingWalletPin(true);
      const response = await resetWalletPinWithOtp({ otp, pin: nextPin });
      setWalletPinSet(Boolean(response.user.has_wallet_pin));
      setWalletPinResetOpen(false);
      setWalletPinResetOtp("");
      setWalletPinResetNew("");
      setWalletPinResetConfirm("");
      await refreshDbUser();
      Alert.alert(
        "Wallet PIN reset",
        response.message || "Wallet PIN reset successfully.",
      );
    } catch (error) {
      Alert.alert(
        "Reset failed",
        error instanceof Error ? error.message : "Could not reset wallet PIN.",
      );
    } finally {
      setResettingWalletPin(false);
    }
  }

  async function handleDeleteFriend(friend: Friend) {
    try {
      setDeletingFriendId(friend.id);
      await deleteFriend(friend.id);
      setFriends((current) => current.filter((item) => item.id !== friend.id));
      Alert.alert("Friend removed", `${getFriendLabel(friend)} was removed.`);
    } catch (error) {
      Alert.alert(
        "Remove failed",
        error instanceof Error ? error.message : "Could not remove friend.",
      );
    } finally {
      setDeletingFriendId("");
    }
  }

  async function handleDownloadMyData() {
    try {
      setDownloadingData(true);
      const data = await downloadMyData();
      Alert.alert(
        "Data export ready",
        `Export prepared at ${formatDate(data.exportedAt, { hour: "2-digit", minute: "2-digit" })}. Mobile download sharing will be added next.`,
      );
    } catch (error) {
      Alert.alert(
        "Export failed",
        error instanceof Error
          ? error.message
          : "Could not prepare data export.",
      );
    } finally {
      setDownloadingData(false);
    }
  }

  async function handleClearLocalSettings() {
    await clearLocalAppSettings();
    Alert.alert(
      "Local settings cleared",
      "Local app settings were reset for this device.",
    );
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation !== deleteAccountConfirmationText) {
      Alert.alert(
        "Confirmation required",
        `Type ${deleteAccountConfirmationText} to continue.`,
      );
      return;
    }

    try {
      setDeletingAccount(true);
      await deleteAccount(deleteConfirmation);
      setDeleteDialogOpen(false);
      await logout();
      router.replace("/");
    } catch (error) {
      Alert.alert(
        "Delete failed",
        error instanceof Error ? error.message : "Could not delete account.",
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <Text style={styles.iconButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.title}>App settings</Text>
        <Text style={styles.subtitle}>
          The same SplitVerse settings from web, adapted for mobile touch.
        </Text>
      </View>

      <AppCard style={styles.card}>
        <Text style={styles.cardEyebrow}>Profile privacy</Text>
        <Text style={styles.cardTitle}>Photo display</Text>
        <SettingSwitch
          title="Use initials instead of photo"
          description="Hide your profile picture and show initials to friends."
          value={avatarId === "initials"}
          onValueChange={(value) => void handleAvatarModeChange(value)}
          disabled={profileSaving}
        />
        <View style={styles.profilePreviewRow}>
          <Avatar
            name={displayName}
            email={email}
            imageUrl={
              avatarId === "initials"
                ? undefined
                : dbUser?.display_photo_url ||
                  dbUser?.profile_photo_url ||
                  dbUser?.photo_url
            }
            size={64}
          />
          <View style={styles.previewCopy}>
            <Text style={styles.rowTitle}>{displayName}</Text>
            <Text style={styles.rowSubtext}>{email}</Text>
          </View>
        </View>
        <AppButton
          title="Upload profile photo"
          variant="secondary"
          loading={profileSaving}
          onPress={handlePickProfilePhoto}
        />
        <AppTextInput
          label="Or paste image URL"
          value={profilePhotoUrl}
          onChangeText={setProfilePhotoUrl}
          placeholder="https://example.com/photo.jpg"
          autoCapitalize="none"
        />
        <AppButton
          title="Save profile photo"
          loading={profileSaving}
          onPress={() => void saveProfileDisplay()}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardEyebrow}>Application currency</Text>
        <Text style={styles.cardTitle}>Money display</Text>
        <Text style={styles.cardText}>
          Use this currency and language across the app.
        </Text>
        <Text style={styles.optionLabel}>Application currency</Text>
        <View style={styles.chipRow}>
          {currencies.map((currency) => (
            <Chip
              key={currency.code}
              label={currency.code}
              active={appCurrency === currency.code}
              onPress={() => void handleAppCurrencyChange(currency.code)}
            />
          ))}
        </View>
        <Text style={styles.optionLabel}>Application language</Text>
        <View style={styles.chipRow}>
          {languages.map((language) => (
            <Chip
              key={language.code}
              label={language.nativeLabel}
              active={appLanguage === language.code}
              onPress={() => void handleAppLanguageChange(language.code)}
            />
          ))}
        </View>
        <View style={styles.previewBox}>
          <Text style={styles.summaryLabel}>Example display</Text>
          <Text style={styles.previewValue}>{formatCurrency(2480)}</Text>
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardEyebrow}>Currency converter</Text>
        <Text style={styles.cardTitle}>Quick conversion</Text>
        <AppTextInput
          label="Amount"
          value={String(converterAmount)}
          onChangeText={(value) => setConverterAmount(Number(value || 0))}
          keyboardType="decimal-pad"
        />
        <Text style={styles.optionLabel}>From</Text>
        <View style={styles.chipRow}>
          {currencies.map((currency) => (
            <Chip
              key={currency.code}
              label={currency.code}
              active={converterFrom === currency.code}
              onPress={() => setConverterFrom(currency.code)}
            />
          ))}
        </View>
        <Text style={styles.optionLabel}>To</Text>
        <View style={styles.chipRow}>
          {currencies.map((currency) => (
            <Chip
              key={currency.code}
              label={currency.code}
              active={converterTo === currency.code}
              onPress={() => setConverterTo(currency.code)}
            />
          ))}
        </View>
        <View style={styles.previewBox}>
          <Text style={styles.summaryLabel}>Converted amount</Text>
          <Text style={styles.previewValue}>
            {formatCurrencyValue(convertedAmount, converterTo)}
          </Text>
        </View>
        <Text style={styles.cardText}>{exchangeRateStatusText}</Text>
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardEyebrow}>Experience</Text>
        <Text style={styles.cardTitle}>User preferences</Text>
        <SettingSwitch
          title="Settlement reminders"
          description="Keep gentle nudges visible for pending dues."
          value={settlementReminders}
          onValueChange={setSettlementReminders}
        />
        <SettingSwitch
          title="Privacy mode"
          description="Hide money values when sharing your screen."
          value={privacyMode}
          onValueChange={setPrivacyMode}
        />
        <SettingSwitch
          title="Compact workspace"
          description="Prefer denser cards and tighter lists."
          value={compactMode}
          onValueChange={setCompactMode}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardEyebrow}>Wallet defaults</Text>
        <Text style={styles.cardTitle}>Payment safety</Text>
        <Text style={styles.optionLabel}>Default wallet top-up method</Text>
        <View style={styles.chipRow}>
          {topUpMethods.map((method) => (
            <Chip
              key={method}
              label={method}
              active={defaultTopUpMethod === method}
              onPress={() => setDefaultTopUpMethod(method)}
            />
          ))}
        </View>
        <SettingSwitch
          title="Ask before wallet payment"
          description="Show a confirmation before paying split-room dues from wallet."
          value={confirmBeforeWalletPayment}
          onValueChange={setConfirmBeforeWalletPayment}
        />
        <Text style={styles.cardTitleSmall}>Change wallet PIN</Text>
        {walletPinSet ? (
          <AppTextInput
            label="Old PIN"
            value={walletPinCurrent}
            onChangeText={(value) =>
              setWalletPinCurrent(normalizePinInput(value))
            }
            keyboardType="number-pad"
            secureTextEntry
          />
        ) : null}
        <AppTextInput
          label="New PIN"
          value={walletPinNew}
          onChangeText={(value) => setWalletPinNew(normalizePinInput(value))}
          keyboardType="number-pad"
          secureTextEntry
        />
        <AppTextInput
          label="Confirm new PIN"
          value={walletPinConfirm}
          onChangeText={(value) =>
            setWalletPinConfirm(normalizePinInput(value))
          }
          keyboardType="number-pad"
          secureTextEntry
        />
        <AppButton
          title={
            savingWalletPin
              ? "Saving PIN"
              : walletPinSet
                ? "Change wallet PIN"
                : "Set wallet PIN"
          }
          loading={savingWalletPin}
          onPress={handleSaveWalletPin}
        />
        {walletPinSet ? (
          <AppButton
            title="Forgot old PIN?"
            variant="secondary"
            onPress={() => setWalletPinResetOpen(true)}
          />
        ) : null}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardEyebrow}>Notifications</Text>
        <Text style={styles.cardTitle}>Preference center</Text>
        <SettingSwitch
          title="Friend request emails"
          description="Allow email invites and friend request updates."
          value={notificationPreferences.friendRequestEmails}
          onValueChange={(value) =>
            setNotificationPreference("friendRequestEmails", value)
          }
        />
        <SettingSwitch
          title="Login OTP emails"
          description="Receive email login codes for safer sign-in."
          value={notificationPreferences.loginOtpEmails}
          onValueChange={(value) =>
            setNotificationPreference("loginOtpEmails", value)
          }
        />
        <SettingSwitch
          title="Settlement reminder emails"
          description="Allow reminders for pending balances and dues."
          value={notificationPreferences.settlementReminderEmails}
          onValueChange={(value) =>
            setNotificationPreference("settlementReminderEmails", value)
          }
        />
        <SettingSwitch
          title="Room due notifications"
          description="Show room dues and wallet payment alerts in the app."
          value={notificationPreferences.roomDueNotifications}
          onValueChange={(value) =>
            setNotificationPreference("roomDueNotifications", value)
          }
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardEyebrow}>Friend control</Text>
        <Text style={styles.cardTitle}>Delete a friend</Text>
        <AppTextInput
          label="Search friend to delete"
          value={friendSearch}
          onChangeText={setFriendSearch}
          placeholder="Search by name or email"
        />
        {friendsLoading ? (
          <LoadingState label="Loading friends..." />
        ) : visibleFriends.length === 0 ? (
          <EmptyState title="No friends to delete" />
        ) : (
          <View style={styles.list}>
            {visibleFriends.map((friend) => (
              <View style={styles.friendRow} key={friend.id}>
                <Avatar
                  name={friend.name}
                  email={friend.email}
                  imageUrl={
                    friend.display_photo_url ||
                    friend.profile_photo_url ||
                    friend.photo_url
                  }
                  size={44}
                />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{getFriendLabel(friend)}</Text>
                  <Text style={styles.rowSubtext}>
                    {friend.email} ·{" "}
                    {formatFriendshipAge(friend.friendship_days)}
                  </Text>
                </View>
                <AppButton
                  title={deletingFriendId === friend.id ? "Removing" : "Remove"}
                  variant="secondary"
                  loading={deletingFriendId === friend.id}
                  onPress={() => void handleDeleteFriend(friend)}
                  style={styles.smallButton}
                />
              </View>
            ))}
          </View>
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardEyebrow}>Danger zone</Text>
        <Text style={styles.cardTitle}>Account control</Text>
        <Text style={styles.cardText}>
          Download your SplitVerse data, reset local settings, or permanently
          delete your account after dues are cleared.
        </Text>
        <AppButton
          title={downloadingData ? "Preparing data" : "Download my data"}
          variant="secondary"
          loading={downloadingData}
          onPress={handleDownloadMyData}
        />
        <AppButton
          title="Clear local app settings"
          variant="secondary"
          onPress={handleClearLocalSettings}
        />
        <AppButton
          title="Delete account"
          variant="secondary"
          onPress={() => setDeleteDialogOpen(true)}
        />
        <AppButton title="Logout" variant="secondary" onPress={logout} />
      </AppCard>

      <SheetModal
        visible={walletPinResetOpen}
        eyebrow="Wallet PIN reset"
        title="Reset wallet PIN"
        onClose={() => setWalletPinResetOpen(false)}
      >
        <AppButton
          title={requestingWalletPinReset ? "Sending OTP" : "Send reset OTP"}
          loading={requestingWalletPinReset}
          onPress={handleRequestWalletPinResetOtp}
        />
        <AppTextInput
          label="OTP"
          value={walletPinResetOtp}
          onChangeText={(value) =>
            setWalletPinResetOtp(value.replace(/\D/g, "").slice(0, 6))
          }
          keyboardType="number-pad"
        />
        <AppTextInput
          label="New PIN"
          value={walletPinResetNew}
          onChangeText={(value) =>
            setWalletPinResetNew(normalizePinInput(value))
          }
          keyboardType="number-pad"
          secureTextEntry
        />
        <AppTextInput
          label="Confirm new PIN"
          value={walletPinResetConfirm}
          onChangeText={(value) =>
            setWalletPinResetConfirm(normalizePinInput(value))
          }
          keyboardType="number-pad"
          secureTextEntry
        />
        <AppButton
          title={resettingWalletPin ? "Resetting PIN" : "Reset wallet PIN"}
          loading={resettingWalletPin}
          onPress={handleResetWalletPin}
        />
      </SheetModal>

      <SheetModal
        visible={deleteDialogOpen}
        eyebrow="Danger zone"
        title="Delete account"
        onClose={() => setDeleteDialogOpen(false)}
      >
        <Text style={styles.cardText}>
          Type {deleteAccountConfirmationText} to permanently delete your
          account.
        </Text>
        <AppTextInput
          label="Confirmation"
          value={deleteConfirmation}
          onChangeText={setDeleteConfirmation}
          placeholder={deleteAccountConfirmationText}
          autoCapitalize="none"
        />
        <AppButton
          title={deletingAccount ? "Deleting account" : "Delete account"}
          loading={deletingAccount}
          onPress={handleDeleteAccount}
        />
      </SheetModal>
    </Screen>
  );
}

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      style={[styles.chip, active && styles.activeChip]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.activeChipText]}>
        {label}
      </Text>
    </Pressable>
  );
}

type SettingSwitchProps = {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

function SettingSwitch({
  title,
  description,
  value,
  onValueChange,
  disabled,
}: SettingSwitchProps) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchTitle}>{title}</Text>
        <Text style={styles.switchDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.hairlineSoft, true: colors.primary }}
        thumbColor={colors.canvas}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.base, backgroundColor: colors.surfaceSoft },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  iconButton: {
    minHeight: 38,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.base,
  },
  iconButtonText: { color: colors.ink, ...typography.caption },
  header: { gap: spacing.xs, paddingTop: spacing.sm },
  eyebrow: { color: colors.primary, ...typography.caption },
  title: { color: colors.ink, ...typography.titleLg },
  subtitle: { color: colors.body, ...typography.bodySm },
  card: { gap: spacing.base },
  cardEyebrow: { color: colors.body, ...typography.caption },
  cardTitle: { color: colors.ink, ...typography.titleMd },
  cardTitleSmall: { color: colors.ink, ...typography.titleSm },
  cardText: { color: colors.body, ...typography.bodySm },
  optionLabel: { color: colors.ink, ...typography.titleSm },
  profilePreviewRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  previewCopy: { flex: 1, minWidth: 0, gap: 2 },
  previewBox: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  previewValue: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  summaryLabel: { color: colors.body, ...typography.caption },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 42,
    minWidth: 78,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.base,
  },
  activeChip: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  activeChipText: { color: colors.canvas },
  switchRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.base,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  switchCopy: { flex: 1, minWidth: 0, gap: 2 },
  switchTitle: { color: colors.ink, ...typography.titleSm },
  switchDescription: { color: colors.body, ...typography.bodySm },
  list: { gap: spacing.sm },
  friendRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.sm,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: colors.ink, ...typography.titleSm },
  rowSubtext: { color: colors.body, ...typography.bodySm },
  smallButton: { minWidth: 90, minHeight: 40, paddingHorizontal: spacing.sm },
});
