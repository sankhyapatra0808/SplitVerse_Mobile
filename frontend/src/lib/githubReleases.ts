/**
 * Resolve the APK from GitHub's latest *published stable* release.
 * Do not build an asset URL from the version: filenames change across releases.
 */
export const SPLITVERSE_LATEST_RELEASE_PAGE =
  "https://github.com/sankhyapatra0808/SplitVerse_Mobile/releases/latest";

const LATEST_RELEASE_API =
  "https://api.github.com/repos/sankhyapatra0808/SplitVerse_Mobile/releases/latest";
const DOWNLOAD_PATH_PREFIX =
  "/sankhyapatra0808/SplitVerse_Mobile/releases/download/";

type GitHubAsset = {
  name?: string;
  browser_download_url?: string;
};

type GitHubRelease = {
  draft?: boolean;
  prerelease?: boolean;
  assets?: GitHubAsset[];
};

export async function fetchLatestSplitVerseApkUrl(
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await fetch(LATEST_RELEASE_API, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) return null;

  const release = (await response.json()) as GitHubRelease;
  if (release.draft || release.prerelease) return null;

  const apkAssets = (release.assets ?? []).filter((asset) => {
    if (!asset.name?.toLowerCase().endsWith(".apk") || !asset.browser_download_url) {
      return false;
    }
    try {
      const url = new URL(asset.browser_download_url);
      return url.origin === "https://github.com" &&
        url.pathname.startsWith(DOWNLOAD_PATH_PREFIX);
    } catch {
      return false;
    }
  });

  // If several APKs are attached, prefer one explicitly named for SplitVerse.
  // Avoid selecting a random asset when names do not identify the app.
  const apkAsset = apkAssets.find((asset) =>
    /^SplitVerse(?:[-_.].*)?\.apk$/i.test(asset.name ?? ""),
  ) ?? (apkAssets.length === 1 ? apkAssets[0] : undefined);

  return apkAsset?.browser_download_url ?? null;
}
