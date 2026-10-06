import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "splitverse_installation_id";
let cachedInstallationId = "";
let pendingInstallationId: Promise<string> | null = null;

function createInstallationId() {
  const globalCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof globalCrypto?.randomUUID === "function") return globalCrypto.randomUUID();
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function loadInstallationId() {
  if (cachedInstallationId) return cachedInstallationId;
  if (pendingInstallationId) return pendingInstallationId;

  pendingInstallationId = (async () => {
    try {
      const existing = (await SecureStore.getItemAsync(STORAGE_KEY))?.trim() || "";
      if (existing) {
        cachedInstallationId = existing;
        return existing;
      }

      const created = createInstallationId();
      await SecureStore.setItemAsync(STORAGE_KEY, created);
      cachedInstallationId = created;
      return created;
    } catch {
      if (!cachedInstallationId) cachedInstallationId = createInstallationId();
      return cachedInstallationId;
    } finally {
      pendingInstallationId = null;
    }
  })();

  return pendingInstallationId;
}

export async function getInstallationHeaders() {
  const installationId = await loadInstallationId();
  return {
    "x-splitverse-installation-id": installationId,
    "x-splitverse-platform": "mobile",
  };
}
