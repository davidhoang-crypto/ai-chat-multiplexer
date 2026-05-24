import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compareVersions,
  createDefaultProfiles,
  createDefaultState,
  createDefaultWorkspace,
  createId,
  DEFAULT_PROFILE_ID,
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
  LEGACY_LAYOUT_KEY,
  LEGACY_STATE_V3_KEY,
  LEGACY_STATE_V4_KEY,
  normalizeUrl,
  resolveAddress,
  STORAGE_KEY,
  type AppState,
  type ChatPane,
  type ChatTab,
} from "./appCore";

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("returns 1 when a > b", () => {
    expect(compareVersions("0.1.5", "0.1.4")).toBe(1);
    expect(compareVersions("1.0.0", "0.9.9")).toBe(1);
    expect(compareVersions("0.2.0", "0.1.99")).toBe(1);
  });

  it("returns -1 when a < b", () => {
    expect(compareVersions("0.1.4", "0.1.5")).toBe(-1);
    expect(compareVersions("0.9.9", "1.0.0")).toBe(-1);
  });

  it("handles different segment counts", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.0")).toBe(1);
  });

  it("handles pre-release suffixes (split on . or -)", () => {
    expect(compareVersions("1.0.0-1", "1.0.0-2")).toBe(-1);
    expect(compareVersions("1.0.0-2", "1.0.0-1")).toBe(1);
  });
});

describe("normalizeUrl", () => {
  it("returns about:blank for empty input", () => {
    expect(normalizeUrl("")).toBe("about:blank");
    expect(normalizeUrl("   ")).toBe("about:blank");
  });

  it("preserves URLs with a scheme", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeUrl("http://localhost:1420")).toBe("http://localhost:1420");
    expect(normalizeUrl("file:///tmp/x")).toBe("file:///tmp/x");
  });

  it("prepends https:// for bare hosts", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("github.com/foo/bar")).toBe("https://github.com/foo/bar");
  });
});

describe("resolveAddress", () => {
  it("returns about:blank for empty input", () => {
    expect(resolveAddress("")).toBe("about:blank");
    expect(resolveAddress("   ")).toBe("about:blank");
  });

  it("preserves URLs with a scheme", () => {
    expect(resolveAddress("https://chatgpt.com")).toBe("https://chatgpt.com");
    expect(resolveAddress("data:text/html,hi")).toBe("data:text/html,hi");
  });

  it("treats localhost / 127.0.0.1 as http URLs", () => {
    expect(resolveAddress("localhost")).toBe("http://localhost");
    expect(resolveAddress("localhost:1420")).toBe("http://localhost:1420");
    expect(resolveAddress("127.0.0.1:8080/foo")).toBe("http://127.0.0.1:8080/foo");
  });

  it("treats hostnames with a dot as URLs", () => {
    expect(resolveAddress("example.com")).toBe("https://example.com");
    expect(resolveAddress("github.com/foo")).toBe("https://github.com/foo");
    expect(resolveAddress("sub.domain.example/path?q=1")).toBe(
      "https://sub.domain.example/path?q=1",
    );
  });

  it("falls back to a Google search for queries with spaces", () => {
    expect(resolveAddress("hello world")).toBe(
      "https://www.google.com/search?q=hello%20world",
    );
  });

  it("falls back to search for plain words without dots", () => {
    expect(resolveAddress("react")).toBe("https://www.google.com/search?q=react");
  });

  it("encodes special characters in search queries", () => {
    expect(resolveAddress("a&b")).toBe("https://www.google.com/search?q=a%26b");
  });
});

describe("getOriginFallbackIcon", () => {
  it("returns the favicon path for valid URLs", () => {
    expect(getOriginFallbackIcon("https://example.com/path")).toBe(
      "https://example.com/favicon.ico",
    );
    expect(getOriginFallbackIcon("github.com/foo")).toBe("https://github.com/favicon.ico");
  });

  it("returns null/favicon.ico for opaque-origin URLs (about:blank etc.)", () => {
    // For about:blank URL.origin is the literal string "null"; we don't treat
    // this as an error since the value is harmless when used as an <img src>.
    expect(getOriginFallbackIcon("")).toBe("null/favicon.ico");
  });

  it("returns empty string when URL constructor throws (line 169 catch)", () => {
    const OriginalURL = globalThis.URL;
    // @ts-expect-error -- temporarily override
    globalThis.URL = function FakeURL() {
      throw new Error("forced parse failure");
    } as unknown as typeof URL;
    try {
      expect(getOriginFallbackIcon("https://valid.com")).toBe("");
    } finally {
      globalThis.URL = OriginalURL;
    }
  });
});

describe("isTauriRuntime", () => {
  it("returns false in jsdom (no __TAURI_INTERNALS__)", () => {
    expect(isTauriRuntime()).toBe(false);
  });

  it("returns true when window has __TAURI_INTERNALS__", () => {
    const w = window as unknown as Record<string, unknown>;
    w.__TAURI_INTERNALS__ = {};
    try {
      expect(isTauriRuntime()).toBe(true);
    } finally {
      delete w.__TAURI_INTERNALS__;
    }
  });
});

describe("getFallbackTabTitle", () => {
  it("returns the host name without www.", () => {
    expect(getFallbackTabTitle("https://www.example.com")).toBe("example.com");
    expect(getFallbackTabTitle("https://github.com/foo")).toBe("github.com");
    expect(getFallbackTabTitle("github.com")).toBe("github.com");
  });

  it("returns the New Tab title for new-tab URLs", () => {
    // The implementation routes through isNewTabUrl which checks the path
    // so we use the canonical /newtab.html path here.
    expect(getFallbackTabTitle("/newtab.html")).toBe("New Tab");
    expect(getFallbackTabTitle("http://localhost:1420/newtab.html")).toBe("New Tab");
  });

  it("returns NEW_TAB_TITLE when hostname is empty after stripping www. (line 182 || branch)", () => {
    const OriginalURL = globalThis.URL;
    // Stub URL so isNewTabUrl returns false (path !== /newtab.html), but
    // hostname.replace(/^www\./, "") returns "" -> the || NEW_TAB_TITLE branch fires.
    // @ts-expect-error -- temporarily override for test
    globalThis.URL = function FakeURL() {
      return { pathname: "/somewhere", hostname: "www." };
    };
    try {
      expect(getFallbackTabTitle("https://www.")).toBe("New Tab");
    } finally {
      globalThis.URL = OriginalURL;
    }
  });

  it("falls back to NEW_TAB_TITLE when URL parsing throws", () => {
    const OriginalURL = globalThis.URL;
    let callCount = 0;
    // @ts-expect-error -- temporarily override
    globalThis.URL = function FakeURL() {
      callCount += 1;
      // first call is from isNewTabUrl (returns false fallback), second is the title parse
      if (callCount >= 2) throw new Error("forced parse failure");
      return { pathname: "/somewhere" };
    };
    try {
      expect(getFallbackTabTitle("https://something")).toBe("New Tab");
    } finally {
      globalThis.URL = OriginalURL;
    }
  });
});

describe("getDisplayUrl", () => {
  const baseTab = (overrides: Partial<ChatTab> = {}): ChatTab => ({
    id: "t1",
    title: "x",
    url: "",
    loadedUrl: "",
    ...overrides,
  });

  it("prefers currentUrl over url over loadedUrl", () => {
    expect(
      getDisplayUrl(
        baseTab({ url: "https://a", loadedUrl: "https://b", currentUrl: "https://c" }),
      ),
    ).toBe("https://c");
  });

  it("returns empty string for new-tab URLs", () => {
    expect(
      getDisplayUrl(
        baseTab({
          url: "/newtab.html",
          loadedUrl: "/newtab.html",
          currentUrl: "/newtab.html",
        }),
      ),
    ).toBe("");
  });

  it("falls back to loadedUrl when currentUrl and url are empty (line 174 third branch)", () => {
    expect(
      getDisplayUrl(baseTab({ currentUrl: "", url: "", loadedUrl: "https://only-loaded.example" })),
    ).toBe("https://only-loaded.example");
  });
});

describe("getTabTitle", () => {
  it("uses tab.title when set", () => {
    expect(
      getTabTitle({
        id: "t",
        title: "Custom",
        url: "https://example.com",
        loadedUrl: "https://example.com",
      }),
    ).toBe("Custom");
  });

  it("falls back to host when title is blank", () => {
    expect(
      getTabTitle({
        id: "t",
        title: "  ",
        url: "https://example.com",
        loadedUrl: "https://example.com",
      }),
    ).toBe("example.com");
  });
});

describe("getTabKey", () => {
  it("joins paneId and tabId with a colon", () => {
    expect(getTabKey("p1", "t1")).toBe("p1:t1");
  });
});

describe("getNativeWebviewLabel", () => {
  it("uses ONLY tab.id (not paneId) so the label survives moves", () => {
    const tab: ChatTab = {
      id: "tab-abc-123",
      title: "x",
      url: "https://example.com",
      loadedUrl: "https://example.com",
    };
    expect(getNativeWebviewLabel("paneA", tab)).toBe("tab-tab-abc-123");
    expect(getNativeWebviewLabel("paneB", tab)).toBe("tab-tab-abc-123");
  });

  it("sanitizes non-alphanumeric characters", () => {
    const tab: ChatTab = {
      id: "weird id?$",
      title: "x",
      url: "x",
      loadedUrl: "x",
    };
    expect(getNativeWebviewLabel("p", tab)).toBe("tab-weird-id--");
  });
});

describe("isPaneDragControl", () => {
  it("returns false for null targets", () => {
    expect(isPaneDragControl(null)).toBe(false);
  });

  it("returns true when target is inside a button", () => {
    const button = document.createElement("button");
    const span = document.createElement("span");
    button.appendChild(span);
    expect(isPaneDragControl(span)).toBe(true);
  });

  it("returns false for a plain div", () => {
    const div = document.createElement("div");
    expect(isPaneDragControl(div)).toBe(false);
  });
});

describe("createId", () => {
  it("generates unique ids with the given prefix", () => {
    const a = createId("test");
    const b = createId("test");
    expect(a).toMatch(/^test-/);
    expect(b).toMatch(/^test-/);
    expect(a).not.toBe(b);
  });
});

describe("createDefaultProfiles", () => {
  it("returns a single Default profile with the constant id", () => {
    const profiles = createDefaultProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe(DEFAULT_PROFILE_ID);
    expect(profiles[0].name).toBe("Default");
  });
});

describe("createDefaultWorkspace", () => {
  it("uses the given name and includes one default pane with one tab", () => {
    const ws = createDefaultWorkspace("MyWS");
    expect(ws.name).toBe("MyWS");
    expect(ws.columns).toBe(1);
    expect(ws.panes).toHaveLength(1);
    expect(ws.panes[0].profileId).toBe(DEFAULT_PROFILE_ID);
    expect(ws.panes[0].tabs).toHaveLength(1);
  });
});

describe("createDefaultState", () => {
  it("returns a state with a single workspace and Default profile", () => {
    const state = createDefaultState();
    expect(state.workspaces).toHaveLength(1);
    expect(state.profiles).toHaveLength(1);
    expect(state.activeWorkspaceId).toBe(state.workspaces[0].id);
  });
});

describe("hydrateTabs", () => {
  it("backfills loadedUrl/currentUrl/faviconUrl/isLoading from null/undefined", () => {
    // Note: hydrateTabs uses ?? so it only backfills when the field is
    // null/undefined — empty strings are kept as-is. Use undefined to test.
    const result = hydrateTabs([
      {
        id: "t",
        title: "x",
        url: "https://example.com",
        loadedUrl: undefined as unknown as string,
      },
    ]);
    expect(result[0].loadedUrl).toBe("https://example.com");
    expect(result[0].currentUrl).toBe("https://example.com");
    expect(result[0].faviconUrl).toBe("https://example.com/favicon.ico");
    expect(result[0].isLoading).toBe(false);
  });

  it("preserves an existing currentUrl/faviconUrl when present", () => {
    const result = hydrateTabs([
      {
        id: "t",
        title: "x",
        url: "https://a.com",
        loadedUrl: "https://a.com",
        currentUrl: "https://b.com",
        faviconUrl: "https://b.com/icon.png",
      },
    ]);
    expect(result[0].currentUrl).toBe("https://b.com");
    expect(result[0].faviconUrl).toBe("https://b.com/icon.png");
  });
});

describe("loadAppState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns default state when storage is empty", () => {
    const state = loadAppState();
    expect(state.workspaces).toHaveLength(1);
    expect(state.profiles).toHaveLength(1);
  });

  it("loads v5 state directly when present", () => {
    const v5: AppState = {
      workspaces: [
        {
          id: "ws1",
          name: "Test WS",
          columns: 2,
          panes: [
            {
              id: "p1",
              title: "Pane 1",
              profileId: DEFAULT_PROFILE_ID,
              activeTabId: "t1",
              tabs: [{ id: "t1", title: "X", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "ws1",
      profiles: [{ id: DEFAULT_PROFILE_ID, name: "Default" }],
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v5));

    const state = loadAppState();
    expect(state.workspaces[0].name).toBe("Test WS");
    expect(state.workspaces[0].columns).toBe(2);
    expect(state.activeWorkspaceId).toBe("ws1");
  });

  it("falls back to default if active workspace id is invalid", () => {
    const v5: AppState = {
      workspaces: [
        {
          id: "real",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              profileId: DEFAULT_PROFILE_ID,
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "missing-id",
      profiles: [{ id: DEFAULT_PROFILE_ID, name: "Default" }],
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v5));

    const state = loadAppState();
    expect(state.activeWorkspaceId).toBe("real");
  });

  it("re-routes a pane with an unknown profileId to DEFAULT_PROFILE_ID", () => {
    const v5: AppState = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              profileId: "missing-profile",
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "ws",
      profiles: [{ id: DEFAULT_PROFILE_ID, name: "Default" }],
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v5));

    const state = loadAppState();
    expect(state.workspaces[0].panes[0].profileId).toBe(DEFAULT_PROFILE_ID);
  });

  it("migrates legacy v2 layout to a fresh v5 state", () => {
    const legacy = {
      columns: 2,
      panes: [
        {
          id: "p",
          title: "p",
          activeTabId: "t",
          tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
        },
      ],
    };
    window.localStorage.setItem(LEGACY_LAYOUT_KEY, JSON.stringify(legacy));

    const state = loadAppState();
    expect(state.workspaces).toHaveLength(1);
    expect(state.workspaces[0].columns).toBe(2);
    expect(state.workspaces[0].panes[0].profileId).toBe(DEFAULT_PROFILE_ID);
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
    // v2 key should be removed after migration
    expect(window.localStorage.getItem(LEGACY_LAYOUT_KEY)).toBeNull();
  });

  it("returns default state when LEGACY_LAYOUT_KEY contains invalid JSON (catch path)", () => {
    window.localStorage.setItem(LEGACY_LAYOUT_KEY, "{not valid json");
    const state = loadAppState();
    // migrateLegacyLayout returns null → loadAppState falls through to defaults.
    expect(state.workspaces.length).toBeGreaterThan(0);
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
  });

  it("migrates v3 (multiple workspaces, no profiles) to v5", () => {
    const v3 = {
      workspaces: [
        {
          id: "wsA",
          name: "A",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "wsA",
    };
    window.localStorage.setItem(LEGACY_STATE_V3_KEY, JSON.stringify(v3));

    const state = loadAppState();
    expect(state.workspaces[0].name).toBe("A");
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
    expect(state.workspaces[0].panes[0].profileId).toBe(DEFAULT_PROFILE_ID);
    expect(window.localStorage.getItem(LEGACY_STATE_V3_KEY)).toBeNull();
  });

  it("collapses v4 per-preset profiles by name", () => {
    // v4 had multiple profile entries that may share a name (e.g. two "Default"
    // profiles for different presets). Migration should merge them into one.
    const v4 = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p1",
              title: "p1",
              profileId: "old-default-claude",
              activeTabId: "t1",
              tabs: [{ id: "t1", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
            {
              id: "p2",
              title: "p2",
              profileId: "old-work-chatgpt",
              activeTabId: "t2",
              tabs: [{ id: "t2", title: "y", url: "https://y", loadedUrl: "https://y" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "ws",
      profiles: [
        { id: "old-default-claude", name: "Default", presetId: "claude" },
        { id: "old-default-chatgpt", name: "Default", presetId: "chatgpt" },
        { id: "old-work-chatgpt", name: "Work", presetId: "chatgpt" },
      ],
    };
    window.localStorage.setItem(LEGACY_STATE_V4_KEY, JSON.stringify(v4));

    const state = loadAppState();

    // Two distinct profile names → two profiles in v5.
    const names = state.profiles.map((p) => p.name).sort();
    expect(names).toEqual(["Default", "Work"]);

    // First pane was on a "Default" profile, must map to DEFAULT_PROFILE_ID.
    expect(state.workspaces[0].panes[0].profileId).toBe(DEFAULT_PROFILE_ID);

    // Second pane was on "Work" — must map to whatever id we gave Work.
    const workId = state.profiles.find((p) => p.name === "Work")!.id;
    expect(state.workspaces[0].panes[1].profileId).toBe(workId);

    // v4 key should be removed after migration.
    expect(window.localStorage.getItem(LEGACY_STATE_V4_KEY)).toBeNull();
  });

  it("falls back to a default state when LEGACY_STATE_V3 contains malformed JSON", () => {
    window.localStorage.setItem(LEGACY_STATE_V3_KEY, "{not valid json");
    const state = loadAppState();
    // Migration returns null for malformed JSON; loadAppState falls back to a fresh state
    expect(state.workspaces.length).toBeGreaterThan(0);
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
  });

  it("falls back to a default state when LEGACY_STATE_V4 contains malformed JSON", () => {
    window.localStorage.setItem(LEGACY_STATE_V4_KEY, "{not valid json");
    const state = loadAppState();
    expect(state.workspaces.length).toBeGreaterThan(0);
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
  });

  it("v4 migration uses first workspace id when activeWorkspaceId is missing (line 315)", () => {
    const v4 = {
      workspaces: [
        {
          id: "first-ws",
          name: "First",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              profileId: "prof-default",
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      // activeWorkspaceId omitted entirely → first workspace becomes active.
      profiles: [{ id: "prof-default", name: "Default", presetId: "claude" }],
    };
    window.localStorage.setItem(LEGACY_STATE_V4_KEY, JSON.stringify(v4));
    const state = loadAppState();
    expect(state.activeWorkspaceId).toBe("first-ws");
  });

  it("v4 migration falls back to DEFAULT_PROFILE_ID when pane.profileId is missing (line 309 falsy)", () => {
    const v4 = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              // profileId intentionally missing → falsy branch on line 307.
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "ws",
      profiles: [{ id: "prof-old", name: "Default", presetId: "claude" }],
    };
    window.localStorage.setItem(LEGACY_STATE_V4_KEY, JSON.stringify(v4));
    const state = loadAppState();
    expect(state.workspaces[0].panes[0].profileId).toBe(DEFAULT_PROFILE_ID);
  });

  it("v4 migration falls back to DEFAULT when pane.profileId is unknown (line 308 nullish)", () => {
    const v4 = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              profileId: "ghost-id-not-in-profiles",
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "ws",
      profiles: [{ id: "prof-old", name: "Default", presetId: "claude" }],
    };
    window.localStorage.setItem(LEGACY_STATE_V4_KEY, JSON.stringify(v4));
    const state = loadAppState();
    // pane.profileId is truthy but not in oldIdToNewId map → ?? falls through to DEFAULT.
    expect(state.workspaces[0].panes[0].profileId).toBe(DEFAULT_PROFILE_ID);
  });

  it("v4 migration with NO profiles array maps panes to DEFAULT_PROFILE_ID (line 310 falsy)", () => {
    // Pane has no profileId at all → falls into the right-hand branch of the ?: at line 310.
    const v4 = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "ws",
      // profiles intentionally omitted (undefined) so (parsed.profiles ?? []) hits its right side.
    };
    window.localStorage.setItem(LEGACY_STATE_V4_KEY, JSON.stringify(v4));
    const state = loadAppState();
    expect(state.workspaces[0].panes[0].profileId).toBe(DEFAULT_PROFILE_ID);
    expect(state.profiles.find((p) => p.id === DEFAULT_PROFILE_ID)).toBeDefined();
  });

  it("v4 migration: empty workspaces array returns null and falls through (line 284 false)", () => {
    const v4 = { workspaces: [], activeWorkspaceId: "ignored", profiles: [] };
    window.localStorage.setItem(LEGACY_STATE_V4_KEY, JSON.stringify(v4));
    const state = loadAppState();
    // V4 returned null → loadAppState falls back to default state.
    expect(state.workspaces.length).toBeGreaterThan(0);
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
  });

  it("v4 migration: profile with whitespace-only name maps to 'Default'", () => {
    const v4 = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              profileId: "old-blank",
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "ws",
      // Whitespace name should fall back to "Default" (covers `(p.name ?? "Default").trim() || "Default"`).
      profiles: [{ id: "old-blank", name: "   ", presetId: "claude" }],
    };
    window.localStorage.setItem(LEGACY_STATE_V4_KEY, JSON.stringify(v4));
    const state = loadAppState();
    expect(state.workspaces[0].panes[0].profileId).toBe(DEFAULT_PROFILE_ID);
  });

  it("v3 migration: empty workspaces array returns null and falls through (line 250 false)", () => {
    const v3 = { workspaces: [], activeWorkspaceId: "ignored" };
    window.localStorage.setItem(LEGACY_STATE_V3_KEY, JSON.stringify(v3));
    const state = loadAppState();
    expect(state.workspaces.length).toBeGreaterThan(0);
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
  });

  it("v3 migration uses first workspace id when activeWorkspaceId is missing (line 262 false)", () => {
    const v3 = {
      workspaces: [
        {
          id: "ws-only",
          name: "Only",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      // activeWorkspaceId omitted entirely.
    };
    window.localStorage.setItem(LEGACY_STATE_V3_KEY, JSON.stringify(v3));
    const state = loadAppState();
    expect(state.activeWorkspaceId).toBe("ws-only");
  });

  it("v3 migration handles panes whose tabs field is missing (line 257 fallback)", () => {
    const v3 = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              activeTabId: "t",
              // tabs missing → hydrateTabs(pane.tabs ?? []) hits the right side.
            },
          ],
        },
      ],
      activeWorkspaceId: "ws",
    };
    window.localStorage.setItem(LEGACY_STATE_V3_KEY, JSON.stringify(v3));
    const state = loadAppState();
    expect(state.workspaces[0].panes[0].tabs).toEqual([]);
  });

  it("legacy layout migration: empty panes array returns null (line 224 false)", () => {
    const legacy = { columns: 1, panes: [] };
    window.localStorage.setItem(LEGACY_LAYOUT_KEY, JSON.stringify(legacy));
    const state = loadAppState();
    expect(state.workspaces.length).toBeGreaterThan(0);
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
  });

  it("legacy layout migration uses default columns=1 when columns is missing (line 229)", () => {
    const legacy = {
      // columns omitted → parsed.columns ?? 1 hits the right side.
      panes: [
        {
          id: "p",
          title: "p",
          activeTabId: "t",
          tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
        },
      ],
    };
    window.localStorage.setItem(LEGACY_LAYOUT_KEY, JSON.stringify(legacy));
    const state = loadAppState();
    expect(state.workspaces[0].columns).toBe(1);
  });

  it("legacy layout migration handles pane with missing tabs (line 233 fallback)", () => {
    const legacy = {
      columns: 1,
      panes: [
        {
          id: "p",
          title: "p",
          activeTabId: "t",
          // tabs omitted.
        },
      ],
    };
    window.localStorage.setItem(LEGACY_LAYOUT_KEY, JSON.stringify(legacy));
    const state = loadAppState();
    expect(state.workspaces[0].panes[0].tabs).toEqual([]);
  });

  it("loadAppState uses createDefaultProfiles when STORAGE_KEY has no profiles array (lines 331-333)", () => {
    // STORAGE_KEY is the current ai-chat-multiplexer-state key. Use a saved state
    // with workspaces but NO profiles field at all.
    const stateNoProfiles = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              profileId: "unknown-prof",
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "ws",
      // profiles intentionally omitted → falls into createDefaultProfiles().
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateNoProfiles));
    const state = loadAppState();
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
    // pane.profileId "unknown-prof" not in default profile ids → reset to DEFAULT.
    expect(state.workspaces[0].panes[0].profileId).toBe(DEFAULT_PROFILE_ID);
  });

  it("loadAppState handles pane with missing tabs in current STORAGE_KEY (line 333 fallback)", () => {
    const saved = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              profileId: DEFAULT_PROFILE_ID,
              activeTabId: "t",
              // tabs missing
            },
          ],
        },
      ],
      activeWorkspaceId: "ws",
      profiles: [{ id: DEFAULT_PROFILE_ID, name: "Default" }],
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const state = loadAppState();
    expect(state.workspaces[0].panes[0].tabs).toEqual([]);
  });

  it("v4 migration: profile with name=undefined falls back to 'Default' (line 292 ?? right side)", () => {
    const v4 = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              profileId: "old-undef",
              activeTabId: "t",
              tabs: [{ id: "t", title: "x", url: "https://x", loadedUrl: "https://x" }],
            },
          ],
        },
      ],
      activeWorkspaceId: "ws",
      // p.name is undefined here → `(p.name ?? "Default").trim()` exercises the right side of ??.
      profiles: [{ id: "old-undef", presetId: "claude" } as { id: string; name: string }],
    };
    window.localStorage.setItem(LEGACY_STATE_V4_KEY, JSON.stringify(v4));
    const state = loadAppState();
    expect(state.workspaces[0].panes[0].profileId).toBe(DEFAULT_PROFILE_ID);
  });

  it("v4 migration: pane with missing tabs uses [] fallback (line 310 ?? right side)", () => {
    const v4 = {
      workspaces: [
        {
          id: "ws",
          name: "X",
          columns: 1,
          panes: [
            {
              id: "p",
              title: "p",
              profileId: "old1",
              activeTabId: "t",
              // tabs intentionally omitted (undefined) → `pane.tabs ?? []` right-side branch.
            } as unknown as ChatPane,
          ],
        },
      ],
      activeWorkspaceId: "ws",
      profiles: [{ id: "old1", name: "Default" }],
    };
    window.localStorage.setItem(LEGACY_STATE_V4_KEY, JSON.stringify(v4));
    const state = loadAppState();
    expect(state.workspaces[0].panes[0].tabs).toEqual([]);
  });

  it("loadAppState falls through when STORAGE_KEY workspaces is NOT an array (line 331 false branch)", () => {
    const saved = {
      workspaces: "not-an-array",
      activeWorkspaceId: "ws",
      profiles: [{ id: DEFAULT_PROFILE_ID, name: "Default" }],
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const state = loadAppState();
    // Falls through to legacy/default initialisation — workspaces still produced.
    expect(Array.isArray(state.workspaces)).toBe(true);
    expect(state.workspaces.length).toBeGreaterThan(0);
  });
});
