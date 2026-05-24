import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  AppLogo,
  AppWordmark,
  IconArrowLeft,
  IconArrowRight,
  IconDownload,
  IconEdit,
  IconMaximize,
  IconMinimize,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconTrash,
  IconX,
} from "./Icons";
import { getNewTabUrl, NEW_TAB_TITLE } from "./newtab";
import {
  APP_VERSION,
  DEFAULT_PROFILE_ID,
  GITHUB_REPO,
  RELEASES_URL,
  STORAGE_KEY,
  THEME_STORAGE_KEY,
  compareVersions,
  createDefaultProfiles,
  createDefaultWorkspace,
  createId,
  getDisplayUrl,
  getFallbackTabTitle,
  getNativeWebviewLabel,
  getOriginFallbackIcon,
  getTabKey,
  getTabTitle,
  hydrateTabs,
  isPaneDragControl,
  isTauriRuntime,
  loadAppState,
  normalizeUrl,
  resolveAddress,
  type AppState,
  type ChatPane,
  type ChatTab,
  type NativeTabStatus,
  type Profile,
  type ThemeMode,
  type Workspace,
} from "./appCore";
import { SettingsModal } from "./components/SettingsModal";
import { DownloadToastStack } from "./components/DownloadToastStack";
import { DownloadsPanel } from "./components/DownloadsPanel";
import { WorkspaceSwitcher } from "./components/WorkspaceSwitcher";
import { ConfirmDialog, TextPromptModal } from "./components/Modals";
import { useDownloadManager } from "./hooks/useDownloadManager";

function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "dark" ? "dark" : "light";
  });
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [isNewPaneMenuOpen, setIsNewPaneMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "available"; latest: string; releaseUrl: string }
    | { kind: "current" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [backupBusy, setBackupBusy] = useState<"idle" | "exporting" | "importing">("idle");
  const [textPrompt, setTextPrompt] = useState<{
    title: string;
    initial: string;
    placeholder?: string;
    onSubmit: (value: string) => void;
  } | null>(null);
  const [textPromptValue, setTextPromptValue] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [draggingPaneId, setDraggingPaneId] = useState<string | null>(null);
  const [dragOverPaneId, setDragOverPaneId] = useState<string | null>(null);
  const [editingUrls, setEditingUrls] = useState<Record<string, string>>({});
  const webviewShells = useRef<Record<string, HTMLDivElement | null>>({});
  const nativeWebviews = useRef<Set<string>>(new Set());
  const nativeWebviewUrls = useRef<Record<string, string>>({});
  const paneDrag = useRef<{ paneId: string; pointerId: number; startX: number; startY: number; active: boolean } | null>(null);
  const tabDrag = useRef<{
    paneId: string;
    tabId: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const [tabDragOver, setTabDragOver] = useState<{ paneId: string; tabId: string | null; before: boolean } | null>(null);
  const [draggingTabKey, setDraggingTabKey] = useState<string | null>(null);
  const downloadManager = useDownloadManager();
  const downloadToasts = downloadManager.toasts;
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);

  const activeWorkspace =
    state.workspaces.find((ws) => ws.id === state.activeWorkspaceId) ?? state.workspaces[0];
  const activePanes = activeWorkspace.panes;
  const visiblePanes = focusedPaneId
    ? activePanes.filter((pane) => pane.id === focusedPaneId)
    : activePanes;
  const effectiveColumns = focusedPaneId
    ? 1
    : Math.max(1, Math.min(activeWorkspace.columns, activePanes.length));
  const shouldSuspendNativeWebviews =
    isNewPaneMenuOpen ||
    isWorkspaceMenuOpen ||
    draggingPaneId !== null ||
    textPrompt !== null ||
    confirmDialog !== null ||
    isSettingsOpen ||
    isDownloadsOpen ||
    draggingTabKey !== null;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Close dropdown menus when the user clicks outside of them.
  // Settings modal is intentionally excluded — it has its own backdrop.
  useEffect(() => {
    if (!isNewPaneMenuOpen && !isWorkspaceMenuOpen && !isDownloadsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      if (isNewPaneMenuOpen && !target.closest(".new-pane-menu")) {
        setIsNewPaneMenuOpen(false);
      }
      if (isWorkspaceMenuOpen && !target.closest(".workspace-switcher")) {
        setIsWorkspaceMenuOpen(false);
      }
      if (isDownloadsOpen && !target.closest(".downloads-panel") && !target.closest(".downloads-button")) {
        setIsDownloadsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isNewPaneMenuOpen, isWorkspaceMenuOpen, isDownloadsOpen]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let cancelled = false;

    const syncNativeWebviews = () => {
      const allLabels = new Set<string>();
      const visibleLabels = new Set<string>();

      state.workspaces.forEach((workspace) => {
        const isActiveWorkspace = workspace.id === state.activeWorkspaceId;

        workspace.panes.forEach((pane) => {
          const shell = webviewShells.current[pane.id];
          const profileSessionId = pane.profileId.replace(/[^a-zA-Z0-9_-]/g, "-");
          const isPaneVisible = !focusedPaneId || focusedPaneId === pane.id;

          pane.tabs.forEach((tab) => {
            // Use the latest navigated URL when available so the webview is
            // recreated at the right URL after app restart / HMR. Falls back to
            // loadedUrl for fresh tabs.
            const targetUrl = tab.currentUrl || tab.url || tab.loadedUrl;
            const normalizedUrl = normalizeUrl(targetUrl);
            const label = getNativeWebviewLabel(pane.id, tab);
            allLabels.add(label);

            const canBeVisible =
              isActiveWorkspace &&
              shell &&
              !shouldSuspendNativeWebviews &&
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
            const previousUrl = nativeWebviewUrls.current[label];
            if (previousUrl !== undefined && previousUrl !== normalizedUrl) {
              void invoke("native_webview_load_url", {
                label,
                url: normalizedUrl,
              }).catch((error) => console.error("native_webview_load_url failed", error));
            }
            nativeWebviewUrls.current[label] = normalizedUrl;
          });
        });
      });

      nativeWebviews.current.forEach((label) => {
        if (!allLabels.has(label)) {
          void invoke("native_webview_close", { label }).catch(() => undefined);
          delete nativeWebviewUrls.current[label];
        } else if (!visibleLabels.has(label)) {
          void invoke("native_webview_hide", { label }).catch(() => undefined);
        }
      });

      if (!cancelled) {
        nativeWebviews.current = allLabels;
      }
    };

    const frame = window.requestAnimationFrame(syncNativeWebviews);
    window.addEventListener("resize", syncNativeWebviews);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncNativeWebviews);
    };
  }, [state, focusedPaneId, shouldSuspendNativeWebviews]);

  useEffect(() => {
    if (focusedPaneId && !activePanes.some((pane) => pane.id === focusedPaneId)) {
      setFocusedPaneId(null);
    }
  }, [focusedPaneId, activePanes]);

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

                const nextUrl = status.url || tab.currentUrl || tab.url || tab.loadedUrl;
                const nextTitle = status.title.trim() || getFallbackTabTitle(nextUrl);
                const nextFaviconUrl = status.faviconUrl || getOriginFallbackIcon(nextUrl);

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

  function updateActiveWorkspace(updater: (workspace: Workspace) => Workspace) {
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((ws) =>
        ws.id === current.activeWorkspaceId ? updater(ws) : ws,
      ),
    }));
  }

  function updateActivePane(paneId: string, updater: (pane: ChatPane) => ChatPane) {
    updateActiveWorkspace((workspace) => ({
      ...workspace,
      panes: workspace.panes.map((pane) => (pane.id === paneId ? updater(pane) : pane)),
    }));
  }

  function setColumns(columns: number) {
    updateActiveWorkspace((workspace) => ({ ...workspace, columns }));
  }

  function addBlankPaneWithProfile(profile: Profile) {
    const paneId = createId("pane");
    const tabId = createId("tab");
    const newTabUrl = getNewTabUrl();
    const paneTitle = profile.name === "Default" ? "Main Chat" : profile.name;
    const newPane: ChatPane = {
      id: paneId,
      title: paneTitle,
      profileId: profile.id,
      activeTabId: tabId,
      tabs: [
        {
          id: tabId,
          title: NEW_TAB_TITLE,
          url: newTabUrl,
          loadedUrl: newTabUrl,
          currentUrl: newTabUrl,
        },
      ],
    };
    updateActiveWorkspace((workspace) => ({
      ...workspace,
      panes: [...workspace.panes, newPane],
    }));
  }

  function getProfileById(profileId: string): Profile | undefined {
    return state.profiles.find((p) => p.id === profileId);
  }

  function ensureProfileWithName(profileName: string): Profile {
    const trimmed = profileName.trim() || "Default";
    const existing = state.profiles.find((p) => p.name === trimmed);
    if (existing) return existing;

    const newProfile: Profile = {
      id: createId("prof"),
      name: trimmed,
    };
    setState((current) => ({ ...current, profiles: [...current.profiles, newProfile] }));
    return newProfile;
  }

  function openTextPrompt(opts: { title: string; initial?: string; placeholder?: string; onSubmit: (value: string) => void }) {
    setTextPromptValue(opts.initial ?? "");
    setTextPrompt({
      title: opts.title,
      initial: opts.initial ?? "",
      placeholder: opts.placeholder,
      onSubmit: opts.onSubmit,
    });
  }

  function closeTextPrompt() {
    setTextPrompt(null);
    setTextPromptValue("");
  }

  function submitTextPrompt() {
    if (!textPrompt) return;
    const trimmed = textPromptValue.trim();
    if (!trimmed) {
      closeTextPrompt();
      return;
    }
    textPrompt.onSubmit(trimmed);
    closeTextPrompt();
  }

  function renameProfile(profileId: string) {
    const profile = state.profiles.find((p) => p.id === profileId);
    if (!profile) return;
    openTextPrompt({
      title: `Đổi tên profile`,
      initial: profile.name,
      placeholder: "Tên mới",
      onSubmit: (next) => {
        if (next === profile.name) return;
        setState((current) => ({
          ...current,
          profiles: current.profiles.map((p) => (p.id === profileId ? { ...p, name: next } : p)),
          workspaces: current.workspaces.map((ws) => ({
            ...ws,
            panes: ws.panes.map((pane) => {
              if (pane.profileId !== profileId) return pane;
              const baseTitle = pane.title.split(" — ")[0];
              return {
                ...pane,
                title: next === "Default" ? baseTitle : `${baseTitle} — ${next}`,
              };
            }),
          })),
        }));
      },
    });
  }

  function deleteProfile(profileId: string) {
    const profile = state.profiles.find((p) => p.id === profileId);
    if (!profile) return;

    const inUse = state.workspaces.some((ws) => ws.panes.some((pane) => pane.profileId === profileId));
    if (inUse) {
      setConfirmDialog({
        title: "Profile đang được dùng",
        message: "Profile này đang được dùng bởi một pane đang mở. Đóng pane trước khi xóa.",
        confirmLabel: "OK",
        onConfirm: () => undefined,
      });
      return;
    }

    setConfirmDialog({
      title: `Xóa profile "${profile.name}"?`,
      message: "Toàn bộ cookie và đăng nhập của profile này sẽ bị xóa vĩnh viễn.",
      confirmLabel: "Xóa",
      danger: true,
      onConfirm: () => {
        if (isTauriRuntime()) {
          void invoke("delete_profile_session", {
            profileId: profileId.replace(/[^a-zA-Z0-9_-]/g, "-"),
          }).catch((error) => console.error("delete_profile_session failed", error));
        }
        setState((current) => ({
          ...current,
          profiles: current.profiles.filter((p) => p.id !== profileId),
        }));
      },
    });
  }

  function removePane(paneId: string) {
    updateActiveWorkspace((workspace) => ({
      ...workspace,
      panes: workspace.panes.length > 1 ? workspace.panes.filter((pane) => pane.id !== paneId) : workspace.panes,
    }));
  }

  function addTab(paneId: string) {
    updateActivePane(paneId, (pane) => {
      const tabId = createId("tab");
      const newTabUrl = getNewTabUrl();
      const nextTab: ChatTab = {
        id: tabId,
        title: NEW_TAB_TITLE,
        url: newTabUrl,
        loadedUrl: newTabUrl,
        currentUrl: newTabUrl,
      };

      return {
        ...pane,
        activeTabId: tabId,
        tabs: [...pane.tabs, nextTab],
      };
    });
  }

  function removeTab(paneId: string, tabId: string) {
    updateActivePane(paneId, (pane) => {
      // If this is the last tab, replace it with a fresh new-tab page instead
      // of leaving an empty pane.
      if (pane.tabs.length === 1) {
        if (pane.tabs[0].id !== tabId) return pane;
        const newTabId = createId("tab");
        const newTabUrl = getNewTabUrl();
        return {
          ...pane,
          activeTabId: newTabId,
          tabs: [
            {
              id: newTabId,
              title: NEW_TAB_TITLE,
              url: newTabUrl,
              loadedUrl: newTabUrl,
              currentUrl: newTabUrl,
            },
          ],
        };
      }

      const nextTabs = pane.tabs.filter((tab) => tab.id !== tabId);

      return {
        ...pane,
        tabs: nextTabs,
        activeTabId: pane.activeTabId === tabId ? nextTabs[0].id : pane.activeTabId,
      };
    });
  }

  function startEditingUrl(paneId: string, tab: ChatTab) {
    setEditingUrls((current) => ({
      ...current,
      [getTabKey(paneId, tab.id)]: getDisplayUrl(tab),
    }));
  }

  function updateEditingUrl(paneId: string, tabId: string, value: string) {
    setEditingUrls((current) => ({
      ...current,
      [getTabKey(paneId, tabId)]: value,
    }));
  }

  function commitTabUrl(paneId: string, tabId: string) {
    const tabKey = getTabKey(paneId, tabId);
    const draftUrl = editingUrls[tabKey];

    setEditingUrls((current) => {
      const next = { ...current };
      delete next[tabKey];
      return next;
    });

    if (draftUrl === undefined) {
      return;
    }

    const trimmed = draftUrl.trim();
    if (!trimmed) {
      // Empty input → reset tab to new tab page.
      const newTabUrl = getNewTabUrl();
      updateActivePane(paneId, (pane) => ({
        ...pane,
        tabs: pane.tabs.map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                title: NEW_TAB_TITLE,
                url: newTabUrl,
                loadedUrl: newTabUrl,
                currentUrl: newTabUrl,
                faviconUrl: undefined,
                isLoading: false,
              }
            : tab,
        ),
      }));
      return;
    }

    updateActivePane(paneId, (pane) => ({
      ...pane,
      tabs: pane.tabs.map((tab) => {
        if (tab.id !== tabId) {
          return tab;
        }

        const loadedUrl = resolveAddress(draftUrl);

        return {
          ...tab,
          title: getFallbackTabTitle(loadedUrl),
          url: loadedUrl,
          loadedUrl,
          currentUrl: loadedUrl,
          faviconUrl: getOriginFallbackIcon(loadedUrl),
          isLoading: true,
        };
      }),
    }));
  }

  function navigateActiveWebview(paneId: string, tab: ChatTab, action: "back" | "forward" | "reload") {
    if (!isTauriRuntime()) {
      if (action === "back") {
        window.history.back();
      } else if (action === "forward") {
        window.history.forward();
      } else {
        window.location.reload();
      }
      return;
    }

    void invoke("native_webview_navigate", {
      label: getNativeWebviewLabel(paneId, tab),
      action,
    }).catch((error) => console.error("native_webview_navigate failed", error));
  }

  function moveTabWithinPane(paneId: string, sourceTabId: string, targetTabId: string, before: boolean) {
    if (sourceTabId === targetTabId) return;
    updateActivePane(paneId, (pane) => {
      const sourceIndex = pane.tabs.findIndex((tab) => tab.id === sourceTabId);
      if (sourceIndex < 0) return pane;

      const tabs = [...pane.tabs];
      const [moved] = tabs.splice(sourceIndex, 1);
      const adjustedTarget = tabs.findIndex((tab) => tab.id === targetTabId);
      if (adjustedTarget < 0) {
        // target removed during splice (shouldn't happen) — append.
        tabs.push(moved);
      } else {
        const insertAt = before ? adjustedTarget : adjustedTarget + 1;
        tabs.splice(insertAt, 0, moved);
      }
      return { ...pane, tabs };
    });
  }

  function moveTabAcrossPanes(
    sourcePaneId: string,
    sourceTabId: string,
    targetPaneId: string,
    targetTabId: string | null,
    before: boolean,
  ) {
    if (sourcePaneId === targetPaneId) return;
    updateActiveWorkspace((workspace) => {
      const sourcePane = workspace.panes.find((pane) => pane.id === sourcePaneId);
      const targetPane = workspace.panes.find((pane) => pane.id === targetPaneId);
      if (!sourcePane || !targetPane) return workspace;

      // Only allow if both panes share the same profile.
      if (sourcePane.profileId !== targetPane.profileId) return workspace;

      const tab = sourcePane.tabs.find((t) => t.id === sourceTabId);
      if (!tab) return workspace;

      // Don't leave the source pane empty.
      if (sourcePane.tabs.length <= 1) return workspace;

      const updatedSourceTabs = sourcePane.tabs.filter((t) => t.id !== sourceTabId);
      const updatedSource: ChatPane = {
        ...sourcePane,
        tabs: updatedSourceTabs,
        activeTabId:
          sourcePane.activeTabId === sourceTabId
            ? updatedSourceTabs[0].id
            : sourcePane.activeTabId,
      };

      const targetTabs = [...targetPane.tabs];
      let insertAt = targetTabs.length;
      if (targetTabId) {
        const targetIndex = targetTabs.findIndex((t) => t.id === targetTabId);
        if (targetIndex >= 0) {
          insertAt = before ? targetIndex : targetIndex + 1;
        }
      }
      targetTabs.splice(insertAt, 0, tab);

      const updatedTarget: ChatPane = {
        ...targetPane,
        tabs: targetTabs,
        activeTabId: tab.id,
      };

      return {
        ...workspace,
        panes: workspace.panes.map((pane) => {
          if (pane.id === sourcePaneId) return updatedSource;
          if (pane.id === targetPaneId) return updatedTarget;
          return pane;
        }),
      };
    });
  }

  function detachTabToNewPane(sourcePaneId: string, sourceTabId: string) {
    updateActiveWorkspace((workspace) => {
      const sourcePane = workspace.panes.find((pane) => pane.id === sourcePaneId);
      if (!sourcePane) return workspace;
      const tab = sourcePane.tabs.find((t) => t.id === sourceTabId);
      if (!tab) return workspace;

      // If this is the only tab in the pane, do nothing — moving it would leave
      // an empty pane. (Handled separately by caller if needed.)
      if (sourcePane.tabs.length <= 1) return workspace;

      const remainingTabs = sourcePane.tabs.filter((t) => t.id !== sourceTabId);
      const updatedSource: ChatPane = {
        ...sourcePane,
        tabs: remainingTabs,
        activeTabId:
          sourcePane.activeTabId === sourceTabId ? remainingTabs[0].id : sourcePane.activeTabId,
      };

      const newPane: ChatPane = {
        id: createId("pane"),
        title: sourcePane.title,
        profileId: sourcePane.profileId,
        activeTabId: tab.id,
        tabs: [tab],
      };

      return {
        ...workspace,
        panes: workspace.panes
          .map((pane) => (pane.id === sourcePaneId ? updatedSource : pane))
          .concat(newPane),
      };
    });
  }

  function movePane(sourcePaneId: string, targetPaneId: string) {
    if (sourcePaneId === targetPaneId || focusedPaneId) {
      return;
    }

    updateActiveWorkspace((workspace) => {
      const sourceIndex = workspace.panes.findIndex((pane) => pane.id === sourcePaneId);
      const targetIndex = workspace.panes.findIndex((pane) => pane.id === targetPaneId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return workspace;
      }

      const panes = [...workspace.panes];
      const [sourcePane] = panes.splice(sourceIndex, 1);
      panes.splice(targetIndex, 0, sourcePane);

      return { ...workspace, panes };
    });
  }

  function finishPaneDrag(clientX: number, clientY: number) {
    const activeDrag = paneDrag.current;
    paneDrag.current = null;

    if (activeDrag?.active) {
      const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-pane-id]");
      const targetPaneId = target?.dataset.paneId;

      if (targetPaneId) {
        movePane(activeDrag.paneId, targetPaneId);
      }
    }

    setDraggingPaneId(null);
    setDragOverPaneId(null);
  }

  function switchWorkspace(workspaceId: string) {
    if (workspaceId === state.activeWorkspaceId) return;
    setFocusedPaneId(null);
    setState((current) => ({ ...current, activeWorkspaceId: workspaceId }));
  }

  function createWorkspace() {
    const nextIndex = state.workspaces.length + 1;
    const workspace = createDefaultWorkspace(`Workspace ${nextIndex}`);
    setFocusedPaneId(null);
    setState((current) => ({
      ...current,
      workspaces: [...current.workspaces, workspace],
      activeWorkspaceId: workspace.id,
    }));
  }

  function renameActiveWorkspace() {
    const currentName = activeWorkspace.name;
    openTextPrompt({
      title: "Đổi tên workspace",
      initial: currentName,
      placeholder: "Tên mới",
      onSubmit: (next) => {
        if (next === currentName) return;
        updateActiveWorkspace((workspace) => ({ ...workspace, name: next }));
      },
    });
  }

  function deleteActiveWorkspace() {
    if (state.workspaces.length <= 1) return;

    setConfirmDialog({
      title: `Xóa workspace "${activeWorkspace.name}"?`,
      message: "Tất cả pane bên trong sẽ bị đóng. Profile và session vẫn được giữ lại.",
      confirmLabel: "Xóa",
      danger: true,
      onConfirm: () => {
        setFocusedPaneId(null);
        setState((current) => {
          const remaining = current.workspaces.filter((ws) => ws.id !== current.activeWorkspaceId);
          return {
            ...current,
            workspaces: remaining,
            activeWorkspaceId: remaining[0].id,
          };
        });
      },
    });
  }

  async function checkForUpdates() {
    setUpdateStatus({ kind: "checking" });
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as { tag_name?: string; html_url?: string };
      const latestTag = data.tag_name?.replace(/^v/, "") ?? "";
      const releaseUrl = data.html_url ?? RELEASES_URL;

      if (!latestTag) {
        setUpdateStatus({ kind: "error", message: "Không đọc được phiên bản mới." });
        return;
      }

      if (compareVersions(latestTag, APP_VERSION) > 0) {
        setUpdateStatus({ kind: "available", latest: latestTag, releaseUrl });
      } else {
        setUpdateStatus({ kind: "current" });
      }
    } catch (error) {
      setUpdateStatus({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function openReleasePage(url: string) {
    if (isTauriRuntime()) {
      try {
        await invoke("plugin:opener|open_url", { url });
        return;
      } catch {
        // fallthrough to window.open
      }
    }
    window.open(url, "_blank", "noopener");
  }

  async function exportConfigJson() {
    setBackupBusy("exporting");
    try {
      const json = JSON.stringify(state, null, 2);

      if (isTauriRuntime()) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const filePath = await save({
          title: "Lưu cấu hình",
          defaultPath: `ai-multiplexer-config-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!filePath) {
          setBackupBusy("idle");
          return;
        }
        await invoke("plugin:fs|write_text_file", { path: filePath, contents: json }).catch(
          async () => {
            // tauri-plugin-fs may not be available, fall back to raw command
            const { writeTextFile } = await import("@tauri-apps/plugin-fs").catch(() => ({
              writeTextFile: null as null | ((p: string, c: string) => Promise<void>),
            }));
            if (writeTextFile) {
              await writeTextFile(filePath, json);
              return;
            }
            throw new Error("File system plugin không khả dụng");
          },
        );
      } else {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ai-multiplexer-config-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      window.alert(`Export lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBackupBusy("idle");
    }
  }

  async function importConfigJson() {
    setBackupBusy("importing");
    try {
      let text: string | null = null;

      if (isTauriRuntime()) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const filePath = await open({
          title: "Chọn file cấu hình",
          multiple: false,
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!filePath || typeof filePath !== "string") {
          setBackupBusy("idle");
          return;
        }
        const { readTextFile } = await import("@tauri-apps/plugin-fs").catch(() => ({
          readTextFile: null as null | ((p: string) => Promise<string>),
        }));
        if (!readTextFile) throw new Error("File system plugin không khả dụng");
        text = await readTextFile(filePath);
      } else {
        text = await new Promise<string | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "application/json";
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            resolve(await file.text());
          };
          input.click();
        });
      }

      if (!text) {
        setBackupBusy("idle");
        return;
      }

      const parsed = JSON.parse(text) as AppState;
      if (!Array.isArray(parsed.workspaces) || parsed.workspaces.length === 0) {
        throw new Error("File không phải config hợp lệ");
      }

      setConfirmDialog({
        title: "Thay thế cấu hình hiện tại?",
        message: "Tất cả workspace và profile hiện tại sẽ bị thay bằng nội dung từ file.",
        confirmLabel: "Thay thế",
        danger: true,
        onConfirm: () => {
          const profiles =
            Array.isArray(parsed.profiles) && parsed.profiles.length > 0
              ? parsed.profiles
              : createDefaultProfiles();
          const profileIds = new Set(profiles.map((p) => p.id));
          const workspaces = parsed.workspaces.map((ws) => ({
            ...ws,
            panes: ws.panes.map((pane) => ({
              ...pane,
              profileId: profileIds.has(pane.profileId) ? pane.profileId : DEFAULT_PROFILE_ID,
              tabs: hydrateTabs(pane.tabs ?? []),
            })),
          }));
          const activeId = workspaces.some((ws) => ws.id === parsed.activeWorkspaceId)
            ? parsed.activeWorkspaceId
            : workspaces[0].id;
          setState({ workspaces, activeWorkspaceId: activeId, profiles });
          setFocusedPaneId(null);
        },
      });
    } catch (error) {
      window.alert(`Import lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBackupBusy("idle");
    }
  }

  async function exportFullBackup() {
    if (!isTauriRuntime()) {
      window.alert("Backup full (kèm session/cookie) chỉ chạy được trong app desktop.");
      return;
    }
    setBackupBusy("exporting");
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const filePath = await save({
        title: "Lưu full backup",
        defaultPath: `ai-multiplexer-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!filePath) {
        setBackupBusy("idle");
        return;
      }
      // Save config alongside zip as <name>.json
      const configPath = filePath.replace(/\.zip$/i, ".json");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs").catch(() => ({
        writeTextFile: null as null | ((p: string, c: string) => Promise<void>),
      }));
      if (writeTextFile) {
        await writeTextFile(configPath, JSON.stringify(state, null, 2));
      }
      await invoke("backup_sessions_zip", { outputPath: filePath });
      window.alert(
        `Backup hoàn tất:\n• ${filePath}\n• ${configPath}\n\nĐể restore, dùng cả 2 file.`,
      );
    } catch (error) {
      window.alert(`Backup lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBackupBusy("idle");
    }
  }

  async function restoreFullBackup() {
    if (!isTauriRuntime()) {
      window.alert("Restore full chỉ chạy được trong app desktop.");
      return;
    }
    setBackupBusy("importing");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const filePath = await open({
        title: "Chọn file backup .zip (sessions)",
        multiple: false,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!filePath || typeof filePath !== "string") {
        setBackupBusy("idle");
        return;
      }

      setConfirmDialog({
        title: "Restore session?",
        message: "Cookies hiện tại sẽ bị thay thế. App sẽ cần restart để áp dụng đầy đủ.",
        confirmLabel: "Restore",
        danger: true,
        onConfirm: async () => {
          try {
            await invoke("restore_sessions_zip", { inputPath: filePath });
            window.alert("Đã restore. Hãy đóng và mở lại app để áp dụng đầy đủ.");
          } catch (error) {
            window.alert(`Restore lỗi: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
      });
    } catch (error) {
      window.alert(`Restore lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBackupBusy("idle");
    }
  }

  return (
    <main className={`app-shell theme-${theme}`}>
      <header className="terminal-topbar">
        <section className="brand">
          <div className="brand-badge" aria-label="AI Multiplexer">
            <span className="brand-mark" aria-hidden="true">
              <AppLogo size={26} />
            </span>
            <AppWordmark height={20} className="brand-wordmark" />
            <span className="brand-shimmer" aria-hidden="true" />
          </div>
        </section>

        <section className="workspace-center">
          <WorkspaceSwitcher
            workspaces={state.workspaces}
            activeWorkspaceId={state.activeWorkspaceId}
            activePaneCount={activePanes.length}
            open={isWorkspaceMenuOpen}
            onOpenChange={setIsWorkspaceMenuOpen}
            onSwitch={switchWorkspace}
            onCreate={createWorkspace}
            onRename={renameActiveWorkspace}
            onDelete={deleteActiveWorkspace}
          />
        </section>

        <section className="toolbar" aria-label="Điều khiển layout">
          <div className="layout-segment" aria-label="Chọn bố cục">
            {[
              { value: 1, label: "Focus" },
              { value: 2, label: "2" },
              { value: 3, label: "3" },
              { value: 4, label: "4" },
            ].map((item) => {
              const isActiveLayout = activeWorkspace.columns === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  className={isActiveLayout ? "segment active" : "segment"}
                  onClick={() => setColumns(item.value)}
                  aria-label={`Use ${item.label} column layout`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <details
            className="new-pane-menu"
            open={isNewPaneMenuOpen}
            onToggle={(event) => setIsNewPaneMenuOpen(event.currentTarget.open)}
          >
            <summary>New pane</summary>
            <div className="preset-menu profile-menu" aria-label="Chọn profile cho pane mới">
              {state.profiles.map((profile) => (
                <div className="profile-row" key={profile.id} role="none">
                  <button
                    type="button"
                    className="profile-pick"
                    onClick={() => {
                      addBlankPaneWithProfile(profile);
                      setIsNewPaneMenuOpen(false);
                    }}
                  >
                    <span className="profile-dot" aria-hidden="true">●</span>
                    <span className="profile-pick-name">{profile.name}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      renameProfile(profile.id);
                    }}
                    aria-label={`Đổi tên ${profile.name}`}
                    title="Đổi tên"
                  >
                    <IconEdit size={11} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteProfile(profile.id);
                    }}
                    aria-label={`Xóa ${profile.name}`}
                    title="Xóa profile"
                  >
                    <IconTrash size={11} />
                  </button>
                </div>
              ))}
              <div className="menu-separator" role="separator" />
              <button
                type="button"
                className="profile-pick profile-create"
                onClick={() => {
                  setIsNewPaneMenuOpen(false);
                  openTextPrompt({
                    title: "Profile mới",
                    initial: "",
                    placeholder: "vd: Work, Personal",
                    onSubmit: (name) => {
                      const profile = ensureProfileWithName(name);
                      addBlankPaneWithProfile(profile);
                    },
                  });
                }}
              >
                <span className="profile-dot" aria-hidden="true">
                  <IconPlus size={11} />
                </span>
                <span>New profile…</span>
              </button>
            </div>
          </details>
          <button
            type="button"
            className="theme-toggle downloads-button"
            onClick={() => setIsDownloadsOpen((open) => !open)}
            aria-label="Tải xuống"
            title="Tải xuống"
          >
            <IconDownload size={14} />
            {downloadManager.hasActiveDownload && (
              <span className="downloads-button-dot" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Mở cài đặt"
            title="Settings"
          >
            <IconSettings size={14} />
          </button>
        </section>
      </header>

      <section className={`split-grid columns-${effectiveColumns} ${focusedPaneId ? "focus-mode" : ""}`}>
        {visiblePanes.map((pane, index) => {
          const activeTab = pane.tabs.find((tab) => tab.id === pane.activeTabId) ?? pane.tabs[0];
          const activeUrl = normalizeUrl(activeTab.loadedUrl);
          const activeDisplayUrl = getDisplayUrl(activeTab);
          const activeTabKey = getTabKey(pane.id, activeTab.id);
          const activeAddressValue = editingUrls[activeTabKey] ?? activeDisplayUrl;
          const paneProfile = getProfileById(pane.profileId);
          const isFocused = focusedPaneId === pane.id;

          return (
            <article
              className={`terminal-pane accent-${index % 4} ${isFocused ? "pane-focused" : ""} ${dragOverPaneId === pane.id ? "pane-drop-target" : ""}`}
              key={pane.id}
              data-pane-id={pane.id}
            >
              <nav
                className="tab-strip"
                aria-label={`Tab của ${pane.title}`}
                onPointerDown={(event) => {
                  if (focusedPaneId || event.button !== 0 || isPaneDragControl(event.target)) {
                    return;
                  }

                  paneDrag.current = {
                    paneId: pane.id,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    active: false,
                  };
                  // do NOT setPointerCapture immediately — capture only when actual drag starts
                }}
                onPointerMove={(event) => {
                  const activeDrag = paneDrag.current;

                  if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
                    return;
                  }

                  const distance = Math.hypot(event.clientX - activeDrag.startX, event.clientY - activeDrag.startY);

                  if (!activeDrag.active && distance < 8) {
                    return;
                  }

                  if (!activeDrag.active) {
                    activeDrag.active = true;
                    try {
                      event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                      // ignore — capture may not be available in some browsers
                    }
                  }
                  setDraggingPaneId(activeDrag.paneId);

                  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-pane-id]");
                  const targetPaneId = target?.dataset.paneId;
                  setDragOverPaneId(targetPaneId && targetPaneId !== activeDrag.paneId ? targetPaneId : null);
                }}
                onPointerUp={(event) => finishPaneDrag(event.clientX, event.clientY)}
                onPointerCancel={() => {
                  paneDrag.current = null;
                  setDraggingPaneId(null);
                  setDragOverPaneId(null);
                }}
              >
                <div className="tab-list">
                  {pane.tabs.map((tab) => {
                    const tabTitle = getTabTitle(tab);
                    const tabKey = `${pane.id}:${tab.id}`;
                    const isDragging = draggingTabKey === tabKey;
                    const isDropBefore =
                      tabDragOver?.paneId === pane.id &&
                      tabDragOver?.tabId === tab.id &&
                      tabDragOver?.before === true;
                    const isDropAfter =
                      tabDragOver?.paneId === pane.id &&
                      tabDragOver?.tabId === tab.id &&
                      tabDragOver?.before === false;

                    return (
                    <button
                      className={
                        (tab.id === pane.activeTabId ? "tab active" : "tab") +
                        (isDragging ? " tab-dragging" : "") +
                        (isDropBefore ? " tab-drop-before" : "") +
                        (isDropAfter ? " tab-drop-after" : "")
                      }
                      key={tab.id}
                      title={tabTitle}
                      draggable={false}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        // ignore pointerdown on the close button so it can fire its own click
                        if ((event.target as HTMLElement).closest(".tab-close")) return;
                        event.stopPropagation(); // don't trigger pane drag
                        tabDrag.current = {
                          paneId: pane.id,
                          tabId: tab.id,
                          pointerId: event.pointerId,
                          startX: event.clientX,
                          startY: event.clientY,
                          active: false,
                        };
                      }}
                      onPointerMove={(event) => {
                        const drag = tabDrag.current;
                        if (!drag || drag.pointerId !== event.pointerId) return;

                        const distance = Math.hypot(
                          event.clientX - drag.startX,
                          event.clientY - drag.startY,
                        );
                        if (!drag.active && distance < 6) return;

                        if (!drag.active) {
                          drag.active = true;
                          setDraggingTabKey(`${pane.id}:${tab.id}`);
                          try {
                            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                          } catch {
                            // ignore
                          }
                        }

                        // Find what we're hovering over.
                        const elementUnderCursor = document.elementFromPoint(
                          event.clientX,
                          event.clientY,
                        );
                        const tabUnder = elementUnderCursor?.closest<HTMLElement>("[data-tab-id]");
                        const paneUnder = elementUnderCursor?.closest<HTMLElement>("[data-pane-id]");

                        if (tabUnder) {
                          const overTabId = tabUnder.dataset.tabId!;
                          const overPaneId = tabUnder.dataset.paneId!;
                          // intra-pane → always allow; cross-pane → only same profile
                          const sourcePane = activePanes.find((p) => p.id === drag.paneId);
                          const overPane = activePanes.find((p) => p.id === overPaneId);
                          if (
                            overPaneId === drag.paneId ||
                            (sourcePane && overPane &&
                              sourcePane.profileId === overPane.profileId &&
                              sourcePane.tabs.length > 1)
                          ) {
                            const rect = tabUnder.getBoundingClientRect();
                            const before = event.clientX < rect.left + rect.width / 2;
                            setTabDragOver({ paneId: overPaneId, tabId: overTabId, before });
                            return;
                          }
                        }

                        // hovering on a tab-list area (no specific tab) of another pane
                        const tabListUnder = elementUnderCursor?.closest<HTMLElement>(".tab-list");
                        if (tabListUnder && paneUnder && paneUnder.dataset.paneId !== drag.paneId) {
                          const overPaneId = paneUnder.dataset.paneId!;
                          const sourcePane = activePanes.find((p) => p.id === drag.paneId);
                          const overPane = activePanes.find((p) => p.id === overPaneId);
                          if (
                            sourcePane && overPane &&
                            sourcePane.profileId === overPane.profileId &&
                            sourcePane.tabs.length > 1
                          ) {
                            setTabDragOver({ paneId: overPaneId, tabId: null, before: false });
                            return;
                          }
                        }

                        setTabDragOver(null);
                      }}
                      onPointerUp={(event) => {
                        const drag = tabDrag.current;
                        if (!drag || drag.pointerId !== event.pointerId) return;
                        try {
                          (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
                        } catch {
                          // ignore
                        }

                        const wasActive = drag.active;
                        const overlay = tabDragOver;
                        tabDrag.current = null;
                        setDraggingTabKey(null);
                        setTabDragOver(null);

                        if (!wasActive) {
                          // simple click → switch active tab
                          updateActivePane(pane.id, (current) => ({ ...current, activeTabId: tab.id }));
                          return;
                        }

                        // Drop logic
                        if (overlay) {
                          if (overlay.tabId) {
                            if (overlay.paneId === drag.paneId) {
                              moveTabWithinPane(drag.paneId, drag.tabId, overlay.tabId, overlay.before);
                            } else {
                              moveTabAcrossPanes(
                                drag.paneId,
                                drag.tabId,
                                overlay.paneId,
                                overlay.tabId,
                                overlay.before,
                              );
                            }
                          } else {
                            // dropped onto empty tab-list area of another pane
                            moveTabAcrossPanes(drag.paneId, drag.tabId, overlay.paneId, null, false);
                          }
                          return;
                        }

                        // Dropped outside any tab → tear out
                        const elementUnderCursor = document.elementFromPoint(
                          event.clientX,
                          event.clientY,
                        );
                        const droppedOnTabStrip = !!elementUnderCursor?.closest(".tab-strip");
                        if (!droppedOnTabStrip) {
                          detachTabToNewPane(drag.paneId, drag.tabId);
                        }
                      }}
                      onPointerCancel={() => {
                        tabDrag.current = null;
                        setDraggingTabKey(null);
                        setTabDragOver(null);
                      }}
                      data-tab-id={tab.id}
                      data-pane-id={pane.id}
                    >
                      {tab.isLoading ? (
                        <span className="tab-spinner" aria-hidden="true" />
                      ) : tab.faviconUrl ? (
                        <img className="tab-favicon" src={tab.faviconUrl} alt="" draggable={false} />
                      ) : null}
                      <span className="tab-label">{tabTitle}</span>
                      <span
                        className="tab-close"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeTab(pane.id, tab.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.stopPropagation();
                            removeTab(pane.id, tab.id);
                          }
                        }}
                        aria-label={`Xóa ${tabTitle}`}
                      >
                        <IconX size={11} />
                      </span>
                    </button>
                    );
                  })}
                </div>
                <div className="tab-actions" aria-label="Điều khiển split chat">
                  <button className="icon-button" onClick={() => addTab(pane.id)} aria-label="Thêm tab">
                    <IconPlus size={13} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => setFocusedPaneId(isFocused ? null : pane.id)}
                    aria-label={isFocused ? "Thu nhỏ pane" : "Phóng to pane"}
                    title={isFocused ? "Thu nhỏ" : "Phóng to"}
                  >
                    {isFocused ? <IconMinimize size={13} /> : <IconMaximize size={13} />}
                  </button>
                  <button className="icon-button danger" onClick={() => removePane(pane.id)} aria-label="Đóng split chat">
                    <IconX size={13} />
                  </button>
                </div>
              </nav>

              <section className="terminal-view">
                <div className="terminal-meta">
                  <div className="browser-controls" aria-label="Điều hướng web">
                    <button type="button" onClick={() => navigateActiveWebview(pane.id, activeTab, "back")} aria-label="Lùi">
                      <IconArrowLeft size={13} />
                    </button>
                    <button type="button" onClick={() => navigateActiveWebview(pane.id, activeTab, "forward")} aria-label="Tiến">
                      <IconArrowRight size={13} />
                    </button>
                    <button type="button" onClick={() => navigateActiveWebview(pane.id, activeTab, "reload")} aria-label="Tải lại">
                      <IconRefresh size={12} />
                    </button>
                  </div>
                  <div className="url-bar">
                    {paneProfile && (
                      <span className="profile-chip" title={`Profile: ${paneProfile.name}`}>
                        @{paneProfile.name}
                      </span>
                    )}
                    <input
                      className="url-input"
                      value={activeAddressValue}
                      onChange={(event) => updateEditingUrl(pane.id, activeTab.id, event.target.value)}
                      onFocus={() => startEditingUrl(pane.id, activeTab)}
                      onBlur={() => commitTabUrl(pane.id, activeTab.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }

                        if (event.key === "Escape") {
                          setEditingUrls((current) => {
                            const next = { ...current };
                            delete next[activeTabKey];
                            return next;
                          });
                          event.currentTarget.blur();
                        }
                      }}
                      aria-label="URL"
                    />
                  </div>
                  <span className="running"><span className={activeTab.isLoading ? "live-dot loading" : "live-dot"} /> {activeTab.isLoading ? "Loading" : "Ready"}</span>
                </div>
                <div
                  className="webview-shell"
                  ref={(element) => {
                    webviewShells.current[pane.id] = element;
                  }}
                >
                  <iframe
                    className="chat-frame"
                    key={`${activeTab.id}-${activeUrl}`}
                    src={activeUrl}
                    title={`${pane.title} / ${activeTab.title}`}
                    sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-downloads"
                  />
                  <div className="frame-fallback">
                    <span className="preview-badge">Web Preview</span>
                    <h2>{activeTab.title}</h2>
                    <p>Trang web không hiển thị được trong bản xem trước. Trên app desktop (Tauri), nội dung sẽ hiển thị đầy đủ.</p>
                    <a href={activeUrl} target="_blank" rel="noreferrer">Mở bằng trình duyệt</a>
                  </div>
                </div>
              </section>
            </article>
          );
        })}
      </section>

      <TextPromptModal
        prompt={textPrompt}
        value={textPromptValue}
        onValueChange={setTextPromptValue}
        onClose={closeTextPrompt}
        onSubmit={submitTextPrompt}
      />

      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        updateStatus={updateStatus}
        onCheckForUpdates={checkForUpdates}
        onOpenReleasePage={openReleasePage}
        backupBusy={backupBusy}
        onExportConfig={exportConfigJson}
        onImportConfig={importConfigJson}
        onExportFullBackup={exportFullBackup}
        onRestoreFullBackup={restoreFullBackup}
      />

      <DownloadToastStack
        toasts={downloadToasts}
        onDismiss={downloadManager.dismissToast}
        onOpenFile={(path) => void downloadManager.openFile(path)}
        onRevealFolder={downloadManager.revealFolder}
      />

      <DownloadsPanel
        open={isDownloadsOpen}
        items={downloadToasts}
        onClose={() => setIsDownloadsOpen(false)}
        onClearAll={downloadManager.clearAll}
        onOpenFile={(path) => void downloadManager.openFile(path)}
        onRevealFolder={downloadManager.revealFolder}
      />
    </main>
  );
}

export default App;
