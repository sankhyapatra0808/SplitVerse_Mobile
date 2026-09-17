import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useAppSettings } from "../context/useAppSettings";
import { radius, spacing, typography } from "../theme/tokens";
import Text from "./LocalizedText";

const GITHUB_OWNER = "sankhyapatra0808";
const GITHUB_REPO = "SplitVerse_Mobile";
const ANDROID_PACKAGE = "com.sankhyapatra.splitverse";
const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const APK_MIME_TYPE = "application/vnd.android.package-archive";
const FLAG_GRANT_READ_URI_PERMISSION = 1;
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;

type GitHubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
  content_type?: string;
  size?: number;
};

type GitHubReleaseResponse = {
  tag_name?: string;
  name?: string;
  body?: string | null;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GitHubReleaseAsset[];
};

type UpdateRelease = {
  version: string;
  title: string;
  notes: string;
  apkUrl: string;
  apkName: string;
  apkSize?: number;
};

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
};

function parseVersion(value: string | null | undefined): ParsedVersion | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^v/i, "");
  const match = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([^+]+))?/);
  if (!match) return null;

  return {
    major: Number(match[1] ?? 0),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
    prerelease: match[4] ?? null,
  };
}

function isNewerVersion(candidate: string, current: string) {
  const next = parseVersion(candidate);
  const installed = parseVersion(current);
  if (!next || !installed) return false;

  const nextParts = [next.major, next.minor, next.patch];
  const currentParts = [installed.major, installed.minor, installed.patch];

  for (let index = 0; index < nextParts.length; index += 1) {
    if (nextParts[index] > currentParts[index]) return true;
    if (nextParts[index] < currentParts[index]) return false;
  }

  // A stable build is newer than the same numbered prerelease. A prerelease is
  // never treated as newer than an already-installed stable build.
  if (installed.prerelease && !next.prerelease) return true;
  if (!installed.prerelease && next.prerelease) return false;

  if (installed.prerelease && next.prerelease) {
    return next.prerelease.localeCompare(installed.prerelease, undefined, {
      numeric: true,
      sensitivity: "base",
    }) > 0;
  }

  return false;
}

function formatMegabytes(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes)) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeReleaseNotes(notes?: string | null) {
  if (!notes?.trim()) return "Bug fixes and improvements.";
  return notes.trim().slice(0, 5000);
}

async function fetchLatestAndroidRelease(): Promise<UpdateRelease | null> {
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub update check failed with HTTP ${response.status}.`);
  }

  const release = (await response.json()) as GitHubReleaseResponse;
  if (release.draft || release.prerelease) return null;

  const apkAsset = (release.assets ?? []).find((asset) => {
    const name = asset.name?.toLowerCase() ?? "";
    const contentType = asset.content_type?.toLowerCase() ?? "";
    return name.endsWith(".apk") || contentType === APK_MIME_TYPE;
  });

  if (!release.tag_name || !apkAsset?.browser_download_url) return null;

  return {
    version: release.tag_name.replace(/^v/i, ""),
    title: release.name?.trim() || `SplitVerse ${release.tag_name}`,
    notes: sanitizeReleaseNotes(release.body),
    apkUrl: apkAsset.browser_download_url,
    apkName: apkAsset.name?.trim() || `SplitVerse-${release.tag_name}.apk`,
    apkSize: apkAsset.size,
  };
}

export default function GitHubUpdateGate() {
  const { theme } = useAppSettings();
  const [release, setRelease] = useState<UpdateRelease | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedApkUri, setDownloadedApkUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showInstallPermissionHelp, setShowInstallPermissionHelp] =
    useState(false);
  const hasCheckedRef = useRef(false);

  const currentVersion = useMemo(
    () => Constants.expoConfig?.version?.trim() || "0.0.0",
    [],
  );

  const checkForUpdate = useCallback(async () => {
    if (Platform.OS !== "android" || __DEV__) return;

    setChecking(true);
    setErrorMessage(null);
    try {
      const latest = await fetchLatestAndroidRelease();
      if (latest && isNewerVersion(latest.version, currentVersion)) {
        setRelease(latest);
      } else {
        setRelease(null);
      }
    } catch (error) {
      // Update checks should never prevent the app from opening when GitHub or
      // the user's connection is temporarily unavailable.
      if (__DEV__) {
        console.warn("Could not check GitHub Releases for an update:", error);
      }
    } finally {
      setChecking(false);
    }
  }, [currentVersion]);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    void checkForUpdate();
  }, [checkForUpdate]);

  const launchInstaller = useCallback(async (fileUri: string) => {
    try {
      const contentUri = await FileSystem.getContentUriAsync(fileUri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: APK_MIME_TYPE,
        flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
      });
      setShowInstallPermissionHelp(false);
    } catch (error) {
      setShowInstallPermissionHelp(true);
      setErrorMessage(
        "Android could not open the update installer. Allow SplitVerse to install apps, then try installing the downloaded update again.",
      );
      if (__DEV__) {
        console.warn("Could not launch Android APK installer:", error);
      }
    }
  }, []);

  const startUpdate = useCallback(async () => {
    if (!release || downloading) return;

    setErrorMessage(null);
    setShowInstallPermissionHelp(false);

    if (downloadedApkUri) {
      await launchInstaller(downloadedApkUri);
      return;
    }

    if (!FileSystem.cacheDirectory) {
      setErrorMessage("SplitVerse could not access its update download folder.");
      return;
    }

    const safeVersion = release.version.replace(/[^0-9A-Za-z._-]/g, "-");
    const destination = `${FileSystem.cacheDirectory}splitverse-update-${safeVersion}.apk`;

    setDownloading(true);
    setDownloadProgress(0);

    try {
      await FileSystem.deleteAsync(destination, { idempotent: true });
      const download = FileSystem.createDownloadResumable(
        release.apkUrl,
        destination,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            setDownloadProgress(
              Math.min(1, totalBytesWritten / totalBytesExpectedToWrite),
            );
          }
        },
      );

      const result = await download.downloadAsync();
      if (!result?.uri) {
        throw new Error("The APK download did not return a local file.");
      }

      setDownloadProgress(1);
      setDownloadedApkUri(result.uri);
      await launchInstaller(result.uri);
    } catch (error) {
      setErrorMessage(
        "The update could not be downloaded. Check your internet connection and try again.",
      );
      if (__DEV__) {
        console.warn("Could not download SplitVerse update:", error);
      }
    } finally {
      setDownloading(false);
    }
  }, [downloadedApkUri, downloading, launchInstaller, release]);

  const openInstallPermissionSettings = useCallback(async () => {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
        { data: `package:${ANDROID_PACKAGE}` },
      );
    } catch (error) {
      setErrorMessage(
        "Open Android Settings > Apps > Special app access > Install unknown apps and allow SplitVerse, then try again.",
      );
      if (__DEV__) {
        console.warn("Could not open unknown app source settings:", error);
      }
    }
  }, []);

  if (Platform.OS !== "android" || __DEV__ || !release) return null;

  const progressPercent = Math.round(downloadProgress * 100);
  const releaseSize = formatMegabytes(release.apkSize);

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => undefined}
      statusBarTranslucent
      visible
    >
      <View style={[styles.screen, { backgroundColor: theme.background }]}> 
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Image
              resizeMode="contain"
              source={require("../../assets/splitverse-logo.png")}
              style={styles.logo}
            />

            <Text style={[styles.eyebrow, { color: theme.primary }]}>UPDATE AVAILABLE</Text>
            <Text style={[styles.title, { color: theme.text }]}>A newer SplitVerse is ready</Text>
            <Text style={[styles.subtitle, { color: theme.body }]}>Update to version {release.version} to continue with the latest SplitVerse.</Text>

            <View
              style={[
                styles.versionRow,
                { backgroundColor: theme.surface, borderColor: theme.borderSoft },
              ]}
            >
              <View style={styles.versionBlock}>
                <Text style={[styles.versionLabel, { color: theme.muted }]}>Installed</Text>
                <Text style={[styles.versionValue, { color: theme.text }]}>v{currentVersion}</Text>
              </View>
              <Text style={[styles.arrow, { color: theme.primary }]}>→</Text>
              <View style={[styles.versionBlock, styles.versionBlockRight]}>
                <Text style={[styles.versionLabel, { color: theme.muted }]}>Available</Text>
                <Text style={[styles.versionValue, { color: theme.primary }]}>v{release.version}</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.text }]}>{"What's new"}</Text>
            <Text style={[styles.releaseNotes, { color: theme.body }]}>{release.notes}</Text>

            {releaseSize ? (
              <Text style={[styles.downloadMeta, { color: theme.muted }]}>APK download: {releaseSize}</Text>
            ) : null}

            {downloading ? (
              <View style={styles.progressArea}>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: theme.surfaceStrong },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: theme.primary,
                        width: `${progressPercent}%` as `${number}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.progressText, { color: theme.body }]}>Downloading update</Text>
                  <Text style={[styles.progressText, { color: theme.primary }]}>{progressPercent}%</Text>
                </View>
              </View>
            ) : null}

            {errorMessage ? (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: theme.surface, borderColor: theme.danger },
                ]}
              >
                <Text style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {showInstallPermissionHelp ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void openInstallPermissionSettings()}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: theme.primary,
                    backgroundColor: theme.surface,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Allow app installs</Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={downloading || checking}
              onPress={() => void startUpdate()}
              style={({ pressed }) => [
                styles.updateButton,
                {
                  backgroundColor: theme.primary,
                  opacity: downloading || checking ? 0.75 : pressed ? 0.88 : 1,
                },
              ]}
            >
              {downloading ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={[styles.updateButtonText, { color: theme.onPrimary }]}>{downloadedApkUri ? "Install downloaded update" : "Update SplitVerse"}</Text>
              )}
            </Pressable>

            <Text style={[styles.installNote, { color: theme.muted }]}>Android will show its normal system confirmation before replacing the installed app.</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xxl,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  logo: {
    width: 68,
    height: 68,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.caption,
    textAlign: "center",
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.titleLg,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodySm,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  versionRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.base,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  versionBlock: {
    flex: 1,
  },
  versionBlockRight: {
    alignItems: "flex-end",
  },
  versionLabel: {
    ...typography.caption,
    marginBottom: 2,
  },
  versionValue: {
    ...typography.titleMd,
  },
  arrow: {
    fontSize: 24,
    marginHorizontal: spacing.sm,
  },
  sectionTitle: {
    ...typography.titleSm,
    marginBottom: spacing.xs,
  },
  releaseNotes: {
    ...typography.bodySm,
    marginBottom: spacing.sm,
  },
  downloadMeta: {
    ...typography.caption,
    marginBottom: spacing.base,
  },
  progressArea: {
    marginBottom: spacing.base,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  progressText: {
    ...typography.caption,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.base,
  },
  errorText: {
    ...typography.bodySm,
  },
  secondaryButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.button,
  },
  updateButton: {
    minHeight: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  updateButtonText: {
    ...typography.button,
  },
  installNote: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
