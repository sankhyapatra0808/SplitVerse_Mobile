import { getAdminAccess } from "./api";

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function clientAdminVisibility(email?: string | null) {
  const normalized = normalize(email);
  if (!normalized) return false;
  return String(process.env.EXPO_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map(normalize)
    .filter(Boolean)
    .includes(normalized);
}

export async function resolveAdminAccess(email?: string | null) {
  if (!clientAdminVisibility(email)) return false;
  const result = await getAdminAccess();
  return result.isAdmin;
}
