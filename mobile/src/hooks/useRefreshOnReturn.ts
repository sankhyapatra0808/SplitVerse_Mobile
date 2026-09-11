import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Runs a memoized refresh callback whenever an already-mounted screen becomes
 * focused again, while intentionally skipping the first focus event because
 * the screen's normal mount effect performs the initial load.
 */
export function useRefreshOnReturn(refresh: () => void | (() => void)) {
  const skipFirstFocusRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocusRef.current) {
        skipFirstFocusRef.current = false;
        return;
      }

      return refresh();
    }, [refresh]),
  );
}
