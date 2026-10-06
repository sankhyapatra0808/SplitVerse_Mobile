import { useEffect, useMemo, useState } from "react";
import { getAdminAccess } from "../lib/api";
import { useAuth } from "../context/useAuth";

let accessCache: { uid: string; isAdmin: boolean; checkedAt: number } | null = null;

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function clientAdminVisibility(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const list = String(import.meta.env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  return list.includes(normalized);
}

export function useAdminAccess(options: { respectClientVisibility?: boolean } = {}) {
  const { user, loading: authLoading } = useAuth();
  const localVisible = useMemo(() => clientAdminVisibility(user?.email), [user?.email]);
  const [state, setState] = useState({ loading: true, isAdmin: false });

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, isAdmin: false });
      return;
    }
    if (options.respectClientVisibility && !localVisible) {
      setState({ loading: false, isAdmin: false });
      return;
    }
    if (accessCache?.uid === user.uid && Date.now() - accessCache.checkedAt < 60_000) {
      setState({ loading: false, isAdmin: accessCache.isAdmin });
      return;
    }
    setState((current) => ({ ...current, loading: true }));
    getAdminAccess()
      .then((result) => {
        accessCache = { uid: user.uid, isAdmin: result.isAdmin, checkedAt: Date.now() };
        if (active) setState({ loading: false, isAdmin: result.isAdmin });
      })
      .catch(() => {
        if (active) setState({ loading: false, isAdmin: false });
      });
    return () => { active = false; };
  }, [authLoading, localVisible, options.respectClientVisibility, user]);


  useEffect(() => {
    const revoke = () => {
      accessCache = user ? { uid: user.uid, isAdmin: false, checkedAt: Date.now() } : null;
      setState({ loading: false, isAdmin: false });
    };
    window.addEventListener("splitverse:admin-access-revoked", revoke);
    return () => window.removeEventListener("splitverse:admin-access-revoked", revoke);
  }, [user]);

  return { ...state, localVisible };
}

export function clearAdminAccessCache() {
  accessCache = null;
}
