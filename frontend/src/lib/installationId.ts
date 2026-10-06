const STORAGE_KEY = "splitverse_installation_id";
let memoryInstallationId = "";

function createInstallationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function getInstallationHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};

  try {
    let installationId = window.localStorage.getItem(STORAGE_KEY)?.trim() || "";

    if (!installationId) {
      installationId = createInstallationId();
      window.localStorage.setItem(STORAGE_KEY, installationId);
    }

    memoryInstallationId = installationId;
  } catch {
    if (!memoryInstallationId) memoryInstallationId = createInstallationId();
  }

  return {
    "x-splitverse-installation-id": memoryInstallationId,
    "x-splitverse-platform": "web",
  };
}
