import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import {
  getFallbackTabTitle,
  getNativeWebviewLabel,
  getOriginFallbackIcon,
  isTauriRuntime,
  type ChatPane,
  type NativeTabStatus,
} from "../appCore";

export interface UseNativeTabStatusArgs {
  activePanes: ChatPane[];
  focusedPaneId: string | null;
  updateActivePane: (paneId: string, updater: (pane: ChatPane) => ChatPane) => void;
}

/**
 * Polls native webview status (URL, title, favicon, loading) for the active
 * tab of every visible pane, and updates state in-place when anything changes.
 * Only runs in the Tauri runtime; no-op in the browser.
 */
export function useNativeTabStatus({
  activePanes,
  focusedPaneId,
  updateActivePane,
}: UseNativeTabStatusArgs) {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let cancelled = false;

    const syncTabStatuses = () => {
      activePanes.forEach((pane) => {
        const activeTab = pane.tabs.find((tab) => tab.id === pane.activeTabId);
        const isPaneVisible = !focusedPaneId || focusedPaneId === pane.id;

        if (!activeTab || !isPaneVisible) {
          return;
        }

        const label = getNativeWebviewLabel(pane.id, activeTab);

        void invoke<NativeTabStatus>("native_webview_tab_status", { label })
          .then((status) => {
            if (cancelled) {
              return;
            }

            updateActivePane(pane.id, (currentPane) => ({
              ...currentPane,
              tabs: currentPane.tabs.map((tab) => {
                if (tab.id !== activeTab.id) {
                  return tab;
                }

                const nextUrl =
                  status.url || tab.currentUrl || tab.url || tab.loadedUrl;
                const nextTitle =
                  status.title.trim() || getFallbackTabTitle(nextUrl);
                const nextFaviconUrl =
                  status.faviconUrl || getOriginFallbackIcon(nextUrl);

                if (
                  tab.title === nextTitle &&
                  tab.url === nextUrl &&
                  tab.currentUrl === nextUrl &&
                  tab.faviconUrl === nextFaviconUrl &&
                  tab.isLoading === status.isLoading
                ) {
                  return tab;
                }

                return {
                  ...tab,
                  title: nextTitle,
                  url: nextUrl,
                  currentUrl: nextUrl,
                  faviconUrl: nextFaviconUrl,
                  isLoading: status.isLoading,
                };
              }),
            }));
          })
          .catch(() => undefined);
      });
    };

    syncTabStatuses();
    const interval = window.setInterval(syncTabStatuses, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanes, focusedPaneId]);
}
