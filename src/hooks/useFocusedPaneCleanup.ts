import { useEffect } from "react";
import type { ChatPane } from "../appCore";

export interface UseFocusedPaneCleanupArgs {
  focusedPaneId: string | null;
  activePanes: ChatPane[];
  setFocusedPaneId: (id: string | null) => void;
}

/**
 * Resets focusedPaneId to null when the focused pane no longer exists in the
 * active workspace (e.g., after pane removal or workspace switch).
 */
export function useFocusedPaneCleanup({
  focusedPaneId,
  activePanes,
  setFocusedPaneId,
}: UseFocusedPaneCleanupArgs): void {
  useEffect(() => {
    if (focusedPaneId && !activePanes.some((pane) => pane.id === focusedPaneId)) {
      setFocusedPaneId(null);
    }
  }, [focusedPaneId, activePanes, setFocusedPaneId]);
}
