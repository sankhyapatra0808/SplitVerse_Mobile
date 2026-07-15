import { useFocusEffect } from "expo-router";
import { useCallback, useRef, type DependencyList } from "react";

/**
 * Runs a refresh callback whenever an already-mounted screen becomes focused
 * again, while intentionally skipping the first focus event because the
 * screen's normal mount effect performs the initial load.
 */
export function useRefreshOnReturn(
  refresh: () => void | (() => void),
  dependencies: DependencyList,
) {
  const skipFirstFocusRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocusRef.current) {
        skipFirstFocusRef.current = false;
        return;
      }

      return refresh();
      // The caller supplies the dependency list so the callback follows the
      // same lifecycle rules as useCallback/useFocusEffect.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies),
  );
}
