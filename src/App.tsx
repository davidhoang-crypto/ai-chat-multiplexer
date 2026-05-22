import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  AppLogo,
  AppWordmark,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconEdit,
  IconMaximize,
  IconMinimize,
  IconMoon,
  IconPlus,
  IconRefresh,
  IconSun,
  IconTrash,
  IconX,
} from "./Icons";
import { getNewTabUrl, isNewTabUrl, NEW_TAB_TITLE } from "./newtab";

type ChatTab = {
  id: string;
  title: string;
  url: string;
  loadedUrl: string;
  currentUrl?: string;
  faviconUrl?: string;
  isLoading?: boolean;
};

type NativeTabStatus = {
  title: string;
  url: string;
  faviconUrl: string;
  isLoading: boolean;
};

type ChatPane = {
  id: string;
  title: string;
  profileId: string;
  tabs: ChatTab[];
  activeTabId: string;
};

type Workspace = {
  id: string;
  name: string;
  columns: number;
  panes: ChatPane[];
};

type ChatPreset = {
  id: "brave" | "chatgpt" | "gemini" | "claude" | "deepseek" | "perplexity";
  title: string;
  url: string;
  logoUrl: string;
};

type Profile = {
  id: string;
  name: string;
};

type AppState = {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  profiles: Profile[];
};

const STORAGE_KEY = "ai-chat-multiplexer-state-v5";
const LEGACY_STATE_V4_KEY = "ai-chat-multiplexer-state-v4";
const LEGACY_STATE_V3_KEY = "ai-chat-multiplexer-state-v3";
const LEGACY_LAYOUT_KEY = "ai-chat-multiplexer-layout-v2";
const THEME_STORAGE_KEY = "ai-chat-multiplexer-theme";
const DEFAULT_URL = "https://search.brave.com/";
const DEFAULT_PROFILE_ID = "prof-default";

type ThemeMode = "light" | "dark";

const CHAT_PRESETS: ChatPreset[] = [
  { id: "brave", title: "Brave", url: DEFAULT_URL, logoUrl: "https://www.google.com/s2/favicons?domain=search.brave.com&sz=64" },
  { id: "chatgpt", title: "ChatGPT", url: "https://chatgpt.com", logoUrl: "https://www.google.com/s2/favicons?domain=chatgpt.com&sz=64" },
  { id: "gemini", title: "Gemini", url: "https://gemini.google.com", logoUrl: "https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64" },
  { id: "claude", title: "Claude", url: "https://claude.ai", logoUrl: "https://www.google.com/s2/favicons?domain=claude.ai&sz=64" },
  { id: "deepseek", title: "DeepSeek", url: "https://chat.deepseek.com", logoUrl: "https://www.google.com/s2/favicons?domain=chat.deepseek.com&sz=64" },
  { id: "perplexity", title: "Perplexity", url: "https://www.perplexity.ai", logoUrl: "https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64" },
];

function PresetLogo({ logoUrl, title }: Pick<ChatPreset, "logoUrl" | "title">) {
  return (
    <span className="preset-logo" aria-hidden="true" title={title}>
      <img src={logoUrl} alt="" draggable={false} referrerPolicy="no-referrer" />
    </span>
  );
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultProfiles(): Profile[] {
  return [{ id: DEFAULT_PROFILE_ID, name: "Default" }];
}

function createDefaultWorkspace(name = "Workspace 1"): Workspace {
  const paneId = createId("pane");
  const tabId = createId("tab");

  return {
    id: createId("ws"),
    name,
    columns: 1,
    panes: [
      {
        id: paneId,
        title: "Main Chat",
        profileId: DEFAULT_PROFILE_ID,
        activeTabId: tabId,
        tabs: [{ id: tabId, title: "Brave", url: DEFAULT_URL, loadedUrl: DEFAULT_URL }],
      },
    ],
  };
}

function createDefaultState(): AppState {
  const workspace = createDefaultWorkspace();
  return {
    workspaces: [workspace],
    activeWorkspaceId: workspace.id,
    profiles: createDefaultProfiles(),
  };
}

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "about:blank";
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function createStableLabelPart(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return Math.abs(hash).toString(36);
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function getOriginFallbackIcon(url: string) {
  try {
    const parsed = new URL(normalizeUrl(url));
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

function getDisplayUrl(tab: ChatTab) {
  const url = tab.currentUrl || tab.url || tab.loadedUrl;
  if (isNewTabUrl(url)) return "";
  return url;
}

function getFallbackTabTitle(url: string) {
  if (isNewTabUrl(url)) return NEW_TAB_TITLE;
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "") || NEW_TAB_TITLE;
  } catch {
    return NEW_TAB_TITLE;
  }
}

function getTabTitle(tab: ChatTab) {
  return tab.title.trim() || getFallbackTabTitle(getDisplayUrl(tab));
}

function getTabKey(paneId: string, tabId: string) {
  return `${paneId}:${tabId}`;
}

function isPaneDragControl(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, select, summary, a, [role='button']"));
}

function createPaneFromPreset(preset: ChatPreset, profileId: string, profileName: string): ChatPane {
  const paneId = createId("pane");
  const tabId = createId("tab");
  const paneTitle = profileName === "Default" ? preset.title : `${preset.title} — ${profileName}`;

  return {
    id: paneId,
    title: paneTitle,
    profileId,
    activeTabId: tabId,
    tabs: [{ id: tabId, title: preset.title, url: preset.url, loadedUrl: preset.url }],
  };
}

function getNativeWebviewLabel(paneId: string, tab: ChatTab) {
  const paneSessionId = paneId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const normalizedUrl = normalizeUrl(tab.loadedUrl);

  return `pane-${paneSessionId}-tab-${tab.id}-url-${createStableLabelPart(normalizedUrl)}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
}

function hydrateTabs(tabs: ChatTab[]): ChatTab[] {
  return tabs.map((tab) => ({
    ...tab,
    loadedUrl: tab.loadedUrl ?? tab.url,
    currentUrl: tab.currentUrl ?? tab.loadedUrl ?? tab.url,
    faviconUrl: tab.faviconUrl ?? getOriginFallbackIcon(tab.loadedUrl ?? tab.url),
    isLoading: false,
  }));
}

function migrateLegacyLayout(): Workspace | null {
  const saved = window.localStorage.getItem(LEGACY_LAYOUT_KEY);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as { columns?: number; panes?: ChatPane[] };
    if (!Array.isArray(parsed.panes) || parsed.panes.length === 0) return null;

    return {
      id: createId("ws"),
      name: "Workspace 1",
      columns: parsed.columns ?? 1,
      panes: parsed.panes.map((pane) => ({
        ...pane,
        profileId: DEFAULT_PROFILE_ID,
        tabs: hydrateTabs(pane.tabs ?? []),
      })),
    };
  } catch {
    return null;
  }
}

function migrateLegacyV3(): { workspaces: Workspace[]; activeWorkspaceId: string } | null {
  const saved = window.localStorage.getItem(LEGACY_STATE_V3_KEY);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as {
      workspaces?: Array<Workspace & { panes: Array<ChatPane & { profileId?: string }> }>;
      activeWorkspaceId?: string;
    };
    if (!Array.isArray(parsed.workspaces) || parsed.workspaces.length === 0) return null;

    const workspaces = parsed.workspaces.map((ws) => ({
      ...ws,
      panes: ws.panes.map((pane) => ({
        ...pane,
        profileId: DEFAULT_PROFILE_ID,
        tabs: hydrateTabs(pane.tabs ?? []),
      })),
    }));

    const activeId =
      parsed.activeWorkspaceId && workspaces.some((ws) => ws.id === parsed.activeWorkspaceId)
        ? parsed.activeWorkspaceId
        : workspaces[0].id;

    return { workspaces, activeWorkspaceId: activeId };
  } catch {
    return null;
  }
}

function migrateLegacyV4(): AppState | null {
  // v4 had per-preset profiles like { id, presetId, name }. Collapse them by name
  // into a single shared profile list. All "Default" become the global Default.
  const saved = window.localStorage.getItem(LEGACY_STATE_V4_KEY);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as {
      workspaces?: Array<Workspace & { panes: Array<ChatPane & { profileId?: string }> }>;
      activeWorkspaceId?: string;
      profiles?: Array<{ id: string; name: string; presetId?: string }>;
    };
    if (!Array.isArray(parsed.workspaces) || parsed.workspaces.length === 0) return null;

    // Build a name -> new profile id map. Keep names unique.
    const nameToId = new Map<string, string>();
    nameToId.set("Default", DEFAULT_PROFILE_ID);

    const oldIdToNewId = new Map<string, string>();
    (parsed.profiles ?? []).forEach((p) => {
      const name = (p.name ?? "Default").trim() || "Default";
      let mappedId = nameToId.get(name);
      if (!mappedId) {
        mappedId = createId("prof");
        nameToId.set(name, mappedId);
      }
      oldIdToNewId.set(p.id, mappedId);
    });

    const profiles: Profile[] = Array.from(nameToId.entries()).map(([name, id]) => ({ id, name }));

    const workspaces = parsed.workspaces.map((ws) => ({
      ...ws,
      panes: ws.panes.map((pane) => ({
        ...pane,
        profileId: pane.profileId
          ? oldIdToNewId.get(pane.profileId) ?? DEFAULT_PROFILE_ID
          : DEFAULT_PROFILE_ID,
        tabs: hydrateTabs(pane.tabs ?? []),
      })),
    }));

    const activeId =
      parsed.activeWorkspaceId && workspaces.some((ws) => ws.id === parsed.activeWorkspaceId)
        ? parsed.activeWorkspaceId
        : workspaces[0].id;

    return { workspaces, activeWorkspaceId: activeId, profiles };
  } catch {
    return null;
  }
}

function loadAppState(): AppState {
  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      const parsed = JSON.parse(saved) as AppState;
      if (Array.isArray(parsed.workspaces) && parsed.workspaces.length > 0) {
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
        return { workspaces, activeWorkspaceId: activeId, profiles };
      }
    } catch {
      // fall through to default
    }
  }

  const v4 = migrateLegacyV4();
  if (v4) {
    window.localStorage.removeItem(LEGACY_STATE_V4_KEY);
    return v4;
  }

  const v3 = migrateLegacyV3();
  if (v3) {
    window.localStorage.removeItem(LEGACY_STATE_V3_KEY);
    return { ...v3, profiles: createDefaultProfiles() };
  }

  const legacy = migrateLegacyLayout();
  if (legacy) {
    window.localStorage.removeItem(LEGACY_LAYOUT_KEY);
    return {
      workspaces: [legacy],
      activeWorkspaceId: legacy.id,
      profiles: createDefaultProfiles(),
    };
  }

  return createDefaultState();
}

function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "dark" ? "dark" : "light";
  });
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [isNewPaneMenuOpen, setIsNewPaneMenuOpen] = useState(false);
  const [profileForNewPane, setProfileForNewPane] = useState<Profile | null>(null);
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
  const paneDrag = useRef<{ paneId: string; pointerId: number; startX: number; startY: number; active: boolean } | null>(null);

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
    confirmDialog !== null;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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
            const normalizedUrl = normalizeUrl(tab.loadedUrl);
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
          });
        });
      });

      nativeWebviews.current.forEach((label) => {
        if (!allLabels.has(label)) {
          void invoke("native_webview_close", { label }).catch(() => undefined);
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

  function addPaneWithProfile(preset: ChatPreset, profile: Profile) {
    updateActiveWorkspace((workspace) => ({
      ...workspace,
      panes: [...workspace.panes, createPaneFromPreset(preset, profile.id, profile.name)],
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
      if (pane.tabs.length === 1) {
        return pane;
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

    updateActivePane(paneId, (pane) => ({
      ...pane,
      tabs: pane.tabs.map((tab) => {
        if (tab.id !== tabId) {
          return tab;
        }

        const loadedUrl = normalizeUrl(draftUrl);

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

  return (
    <main className={`app-shell theme-${theme}`}>
      <header className="terminal-topbar">
        <section className="brand">
          <span className="brand-mark" aria-hidden="true">
            <AppLogo size={24} />
          </span>
          <AppWordmark height={18} className="brand-wordmark" />
          <span className="brand-status">
            <span className="live-dot" /> {activePanes.length} {activePanes.length === 1 ? "pane" : "panes"}
          </span>
        </section>

        <section className="workspace-center">
          <details
            className="workspace-switcher"
            open={isWorkspaceMenuOpen}
            onToggle={(event) => setIsWorkspaceMenuOpen(event.currentTarget.open)}
          >
            <summary aria-label="Chọn workspace">
              <span className="workspace-name">{activeWorkspace.name}</span>
              <IconChevronDown size={12} className="caret" />
            </summary>
            <div className="preset-menu workspace-menu" role="menu" aria-label="Danh sách workspace">
              {state.workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  className={ws.id === state.activeWorkspaceId ? "workspace-item active" : "workspace-item"}
                  onClick={() => {
                    switchWorkspace(ws.id);
                    setIsWorkspaceMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <span className="workspace-dot" aria-hidden="true">
                    {ws.id === state.activeWorkspaceId ? <IconCheck size={12} /> : null}
                  </span>
                  <span>{ws.name}</span>
                  <span className="workspace-meta">{ws.panes.length}</span>
                </button>
              ))}
              <div className="menu-separator" role="separator" />
              <button
                type="button"
                className="workspace-item"
                onClick={() => {
                  createWorkspace();
                  setIsWorkspaceMenuOpen(false);
                }}
                role="menuitem"
              >
                <span className="workspace-dot" aria-hidden="true">
                  <IconPlus size={12} />
                </span>
                <span>New workspace</span>
              </button>
              <button
                type="button"
                className="workspace-item"
                onClick={() => {
                  setIsWorkspaceMenuOpen(false);
                  renameActiveWorkspace();
                }}
                role="menuitem"
              >
                <span className="workspace-dot" aria-hidden="true">
                  <IconEdit size={12} />
                </span>
                <span>Rename current</span>
              </button>
              <button
                type="button"
                className="workspace-item danger-menu-item"
                onClick={() => {
                  setIsWorkspaceMenuOpen(false);
                  deleteActiveWorkspace();
                }}
                disabled={state.workspaces.length <= 1}
                role="menuitem"
              >
                <span className="workspace-dot" aria-hidden="true">
                  <IconTrash size={12} />
                </span>
                <span>Delete current</span>
              </button>
            </div>
          </details>
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
            onToggle={(event) => {
              const open = event.currentTarget.open;
              setIsNewPaneMenuOpen(open);
              if (!open) setProfileForNewPane(null);
            }}
          >
            <summary>New profile</summary>
            {profileForNewPane === null ? (
              <div className="preset-menu profile-menu" aria-label="Chọn profile cho pane mới">
                {state.profiles.map((profile) => (
                    <div className="profile-row" key={profile.id} role="none">
                      <button
                        type="button"
                        className="profile-pick"
                        onClick={() => setProfileForNewPane(profile)}
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
                    setProfileForNewPane(null);
                    openTextPrompt({
                      title: "Profile mới",
                      initial: "",
                      placeholder: "vd: Work, Personal",
                      onSubmit: (name) => {
                        const profile = ensureProfileWithName(name);
                        setProfileForNewPane(profile);
                        setIsNewPaneMenuOpen(true);
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
            ) : (
              <div className="preset-menu" aria-label={`Chọn AI cho ${profileForNewPane.name}`}>
                <button
                  type="button"
                  className="profile-back"
                  onClick={() => setProfileForNewPane(null)}
                >
                  <IconArrowLeft size={12} />
                  <span>{profileForNewPane.name}</span>
                </button>
                <div className="menu-separator" role="separator" />
                {CHAT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      addPaneWithProfile(preset, profileForNewPane);
                      setIsNewPaneMenuOpen(false);
                      setProfileForNewPane(null);
                    }}
                  >
                    <PresetLogo logoUrl={preset.logoUrl} title={preset.title} />
                    <span>{preset.title}</span>
                  </button>
                ))}
              </div>
            )}
          </details>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <IconSun size={14} /> : <IconMoon size={14} />}
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

                    return (
                    <button
                      className={tab.id === pane.activeTabId ? "tab active" : "tab"}
                      key={tab.id}
                      title={tabTitle}
                      draggable={false}
                      onClick={() => updateActivePane(pane.id, (current) => ({ ...current, activeTabId: tab.id }))}
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

      {textPrompt && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTextPrompt(); }}>
          <form
            className="modal-card"
            onSubmit={(event) => {
              event.preventDefault();
              submitTextPrompt();
            }}
          >
            <h3 className="modal-title">{textPrompt.title}</h3>
            <input
              autoFocus
              className="modal-input"
              value={textPromptValue}
              placeholder={textPrompt.placeholder}
              onChange={(event) => setTextPromptValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeTextPrompt();
                }
              }}
            />
            <div className="modal-actions">
              <button type="button" className="modal-btn" onClick={closeTextPrompt}>
                Hủy
              </button>
              <button type="submit" className="modal-btn primary">
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmDialog(null);
          }}
        >
          <div className="modal-card">
            <h3 className="modal-title">{confirmDialog.title}</h3>
            <p className="modal-message">{confirmDialog.message}</p>
            <div className="modal-actions">
              <button type="button" className="modal-btn" onClick={() => setConfirmDialog(null)}>
                Hủy
              </button>
              <button
                type="button"
                className={confirmDialog.danger ? "modal-btn danger" : "modal-btn primary"}
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
              >
                {confirmDialog.confirmLabel ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
