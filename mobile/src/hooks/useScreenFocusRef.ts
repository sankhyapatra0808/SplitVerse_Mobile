import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Exposes the current navigation focus state without causing screen rerenders.
 * Useful for pausing timers and background work when a tab is not visible.
 */
export function useScreenFocusRef() {
  const isFocusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;

      return () => {
        isFocusedRef.current = false;
      };
    }, []),
  );

  return isFocusedRef;
}
