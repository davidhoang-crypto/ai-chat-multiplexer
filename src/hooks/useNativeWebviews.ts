import { invoke } from "@tauri-apps/api/core";
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import {
  getNativeWebviewLabel,
  isTauriRuntime,
  normalizeUrl,
  type AppState,
} from "../appCore";

type Args = {
  state: AppState;
  focusedPaneId: string | null;
  suspended: boolean;
  shellsRef: MutableRefObject<Record<string, HTMLDivElement | null>>;
};

/**
 * Drives the native webview overlays:
 *   1. Mirror the React DOM rectangles into Tauri webview positions.
 *   2. Hide webviews of inactive workspaces / non-active tabs.
 *   3. Re-navigate (load_url) when the desired URL changes without recreating
 *      the webview, so the user's logged-in session is preserved.
 *   4. Close webviews whose tab no longer exists.
 *
 * The hook is a no-op outside Tauri (web preview).
 */
export function useNativeWebviews({ state, focusedPaneId, suspended, shellsRef }: Args) {
  // Set of labels we currently know about, so we can close webviews that
  // disappeared between renders.
  const liveLabels = useRef<Set<string>>(new Set());
  // Last URL we asked each webview to render. Used to decide whether to call
  // load_url on URL changes vs. relying on first-time creation.
  const lastUrlByLabel = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let cancelled = false;

    const sync = () => {
      const allLabels = new Set<string>();
      const visibleLabels = new Set<string>();

      state.workspaces.forEach((workspace) => {
        const isActiveWorkspace = workspace.id === state.activeWorkspaceId;

        workspace.panes.forEach((pane) => {
          const shell = shellsRef.current[pane.id];
          const profileSessionId = pane.profileId.replace(/[^a-zA-Z0-9_-]/g, "-");
          const isPaneVisible = !focusedPaneId || focusedPaneId === pane.id;

          pane.tabs.forEach((tab) => {
            // Use the latest navigated URL when available so the webview is
            // recreated at the right URL after app restart / HMR. Falls back
            // to loadedUrl for fresh tabs.
            const targetUrl = tab.currentUrl || tab.url || tab.loadedUrl;
            const normalizedUrl = normalizeUrl(targetUrl);
            const label = getNativeWebviewLabel(pane.id, tab);
            allLabels.add(label);

            const canBeVisible =
              isActiveWorkspace &&
              shell &&
              !suspended &&
              isPaneVisible &&
              tab.id === pane.activeTabId;

            if (!canBeVisible) {
              void invoke("native_webview_hide", { label }).catch(() => undefined);
              return;
            }

            const bounds = shell!.getBoundingClientRect();
            visibleLabels.add(label);

            void invoke("native_webview_upsert", {
              profileId: profileSessionId,
              label,
              url: normalizedUrl,
              x: bounds.left,
              y: bounds.top,
              width: bounds.width,
              height: bounds.height,
            }).catch((error) => console.error("native_webview_upsert failed", error));

            // If the webview already exists with a different desired URL,
            // navigate it instead of recreating (preserves session/cookies).
            const previousUrl = lastUrlByLabel.current[label];
            if (previousUrl !== undefined && previousUrl !== normalizedUrl) {
              void invoke("native_webview_load_url", {
                label,
                url: normalizedUrl,
              }).catch((error) => console.error("native_webview_load_url failed", error));
            }
            lastUrlByLabel.current[label] = normalizedUrl;
          });
        });
      });

      liveLabels.current.forEach((label) => {
        if (!allLabels.has(label)) {
          void invoke("native_webview_close", { label }).catch(() => undefined);
          delete lastUrlByLabel.current[label];
        } else if (!visibleLabels.has(label)) {
          void invoke("native_webview_hide", { label }).catch(() => undefined);
        }
      });

      if (!cancelled) {
        liveLabels.current = allLabels;
      }
    };

    const frame = window.requestAnimationFrame(sync);
    window.addEventListener("resize", sync);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", sync);
    };
  }, [state, focusedPaneId, suspended, shellsRef]);
}
