import { router, usePathname } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "../context/AuthContext";

/**
 * Keeps wallet setup mandatory without rendering it as an overlay.
 *
 * The actual UI now lives on /wallet-security. Any authenticated user whose
 * wallet PIN is not configured is redirected there until setup is complete.
 */
export default function MandatoryWalletPinSetup() {
  const pathname = usePathname();
  const { user, dbUser, initializing } = useAuth();

  const requiresWalletSetup = Boolean(
    !initializing && user && dbUser && dbUser.has_wallet_pin === false,
  );

  useEffect(() => {
    if (!requiresWalletSetup || pathname === "/wallet-security") {
      return;
    }

    router.replace("/wallet-security");
  }, [pathname, requiresWalletSetup]);

  return null;
}
