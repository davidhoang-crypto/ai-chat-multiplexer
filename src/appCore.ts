// Shared types and pure helper functions used across components.
// Extracted from App.tsx to keep the main file focused on UI composition.

export type ChatTab = {
  id: string;
  title: string;
  url: string;
  loadedUrl: string;
  currentUrl?: string;
  faviconUrl?: string;
  isLoading?: boolean;
};

export type NativeTabStatus = {
  title: string;
  url: string;
  faviconUrl: string;
  isLoading: boolean;
};

export type ChatPane = {
  id: string;
  title: string;
  profileId: string;
  tabs: ChatTab[];
  activeTabId: string;
};

export type Workspace = {
  id: string;
  name: string;
  columns: number;
  panes: ChatPane[];
};

export type Profile = {
  id: string;
  name: string;
};

export type AppState = {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  profiles: Profile[];
};

export type DownloadEventPayload =
  | { kind: "started"; label: string; url: string; path: string }
  | { kind: "finished"; label: string; url: string; path: string | null; success: boolean }
  | { kind: "cancelled"; label: string; url: string };

export type DownloadToast = {
  id: string;
  status: "downloading" | "success" | "error" | "cancelled";
  fileName: string;
  path: string | null;
  /** Wall-clock ms when the download was first noticed (started or finished). */
  createdAt: number;
};

export type ThemeMode = "light" | "dark";

export const STORAGE_KEY = "ai-chat-multiplexer-state-v5";
export const LEGACY_STATE_V4_KEY = "ai-chat-multiplexer-state-v4";
export const LEGACY_STATE_V3_KEY = "ai-chat-multiplexer-state-v3";
export const LEGACY_LAYOUT_KEY = "ai-chat-multiplexer-layout-v2";
export const THEME_STORAGE_KEY = "ai-chat-multiplexer-theme";
export const DEFAULT_URL = "https://search.brave.com/";
export const DEFAULT_PROFILE_ID = "prof-default";
export const APP_VERSION = "0.1.5";
export const GITHUB_REPO = "davidhoang-crypto/ai-chat-multiplexer";
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

import { isNewTabUrl, NEW_TAB_TITLE } from "./newtab";

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const aa = parse(a);
  const bb = parse(b);
  const length = Math.max(aa.length, bb.length);
  for (let index = 0; index < length; index += 1) {
    const left = aa[index] ?? 0;
    const right = bb[index] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

export function createDefaultProfiles(): Profile[] {
  return [{ id: DEFAULT_PROFILE_ID, name: "Default" }];
}

export function createDefaultWorkspace(name = "Workspace 1"): Workspace {
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

export function createDefaultState(): AppState {
  const workspace = createDefaultWorkspace();
  return {
    workspaces: [workspace],
    activeWorkspaceId: workspace.id,
    profiles: createDefaultProfiles(),
  };
}

export function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "about:blank";
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// Decide if a string is a real URL/host or a search query.
// Used by the URL bar and the new-tab search box to mimic browser behavior.
export function resolveAddress(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "about:blank";

  // Plain "localhost", "localhost:1234" or 127.0.0.1[:port]/path → treat as URL.
  // Check this BEFORE the generic scheme check below, otherwise "localhost:1420"
  // would look like a URL whose scheme is "localhost".
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  // Already has a real scheme — pass through.
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;

  // No spaces and looks like a host (has a dot, no path-only tokens).
  // Examples: "google.com", "search.brave.com/", "example.com/path?q=1".
  if (!/\s/.test(trimmed) && /^[\w-]+(\.[\w-]+)+([:/?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Fall back to search engine.
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export function getOriginFallbackIcon(url: string) {
  try {
    const parsed = new URL(normalizeUrl(url));
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

export function getDisplayUrl(tab: ChatTab) {
  const url = tab.currentUrl || tab.url || tab.loadedUrl;
  if (isNewTabUrl(url)) return "";
  return url;
}

export function getFallbackTabTitle(url: string) {
  if (isNewTabUrl(url)) return NEW_TAB_TITLE;
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "") || NEW_TAB_TITLE;
  } catch {
    return NEW_TAB_TITLE;
  }
}

export function getTabTitle(tab: ChatTab) {
  return tab.title.trim() || getFallbackTabTitle(getDisplayUrl(tab));
}

export function getTabKey(paneId: string, tabId: string) {
  return `${paneId}:${tabId}`;
}

export function isPaneDragControl(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, select, summary, a, [role='button']"));
}

export function getNativeWebviewLabel(_paneId: string, tab: ChatTab) {
  // Use ONLY tab.id so the label stays stable when:
  // - the tab is moved between panes (drag tear-out / reorder),
  // - the tab navigates to a different URL.
  // Both would otherwise close+recreate the webview and lose state.
  return `tab-${tab.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function hydrateTabs(tabs: ChatTab[]): ChatTab[] {
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

export function loadAppState(): AppState {
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
