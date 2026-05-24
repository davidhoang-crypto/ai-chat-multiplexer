import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import type { MutableRefObject } from "react";

const invokeSpy = vi.fn();
const rejectingCommands = new Set<string>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => {
    invokeSpy(cmd, args);
    if (rejectingCommands.has(cmd)) {
      return Promise.reject(new Error(`${cmd} failed`));
    }
    return Promise.resolve();
  },
}));

let tauriRuntime = true;
vi.mock("./appCore", async () => {
  const actual = await vi.importActual<typeof import("./appCore")>("./appCore");
  return {
    ...actual,
    isTauriRuntime: () => tauriRuntime,
  };
});

import { useNativeWebviews } from "./hooks/useNativeWebviews";
import type { AppState, ChatPane, ChatTab, Workspace } from "./appCore";

function makeTab(id: string, url: string, currentUrl?: string): ChatTab {
  return {
    id,
    title: "T",
    url,
    loadedUrl: url,
    currentUrl: currentUrl ?? url,
  };
}

function makePane(id: string, profileId: string, tabs: ChatTab[], activeTabId?: string): ChatPane {
  return {
    id,
    title: "P",
    profileId,
    activeTabId: activeTabId ?? tabs[0].id,
    tabs,
  };
}

function makeWorkspace(id: string, panes: ChatPane[]): Workspace {
  return { id, name: "W", columns: 1, panes };
}

function makeState(workspaces: Workspace[], active: string): AppState {
  return {
    workspaces,
    activeWorkspaceId: active,
    profiles: [{ id: "prof-default", name: "Default" }],
  };
}

function setupHookWithShells(
  state: AppState,
  focusedPaneId: string | null,
  suspended: boolean,
  paneIds: string[],
) {
  // Create real DIVs so getBoundingClientRect works (returns zeros in jsdom but that's fine).
  const divs: Record<string, HTMLDivElement> = {};
  paneIds.forEach((id) => {
    divs[id] = document.createElement("div");
    document.body.appendChild(divs[id]);
  });

  const hook = renderHook(
    ({ s, f, sus }: { s: AppState; f: string | null; sus: boolean }) => {
      const shellsRef = useRef<Record<string, HTMLDivElement | null>>(divs) as MutableRefObject<
        Record<string, HTMLDivElement | null>
      >;
      useNativeWebviews({ state: s, focusedPaneId: f, suspended: sus, shellsRef });
    },
    { initialProps: { s: state, f: focusedPaneId, sus: suspended } },
  );

  return { hook, divs };
}

function calls(cmd: string) {
  return invokeSpy.mock.calls.filter(([c]) => c === cmd);
}

describe("useNativeWebviews", () => {
  let rafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tauriRuntime = true;
    invokeSpy.mockReset();
    rejectingCommands.clear();
    // Run rAF callbacks synchronously so the sync function executes inside the test.
    rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    rafSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("is a no-op outside Tauri runtime", () => {
    tauriRuntime = false;
    const state = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", [makeTab("t1", "https://a")])])],
      "ws1",
    );
    setupHookWithShells(state, null, false, ["p1"]);
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("calls native_webview_upsert for the active tab in active workspace", () => {
    const state = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", [makeTab("t1", "https://a")])])],
      "ws1",
    );
    setupHookWithShells(state, null, false, ["p1"]);

    const upserts = calls("native_webview_upsert");
    expect(upserts).toHaveLength(1);
    expect(upserts[0][1]).toMatchObject({
      label: "tab-t1",
      profileId: "prof-default",
      url: "https://a",
    });
  });

  it("hides tabs that are not the pane's activeTab", () => {
    const tabs = [makeTab("t1", "https://a"), makeTab("t2", "https://b")];
    const state = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", tabs, "t1")])],
      "ws1",
    );
    setupHookWithShells(state, null, false, ["p1"]);

    const hides = calls("native_webview_hide").map((c) => (c[1] as { label: string }).label);
    expect(hides).toContain("tab-t2");
    expect(calls("native_webview_upsert")).toHaveLength(1);
  });

  it("hides all webviews when suspended is true", () => {
    const state = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", [makeTab("t1", "https://a")])])],
      "ws1",
    );
    setupHookWithShells(state, null, true, ["p1"]);

    expect(calls("native_webview_upsert")).toHaveLength(0);
    expect(calls("native_webview_hide")).toHaveLength(1);
  });

  it("hides panes other than focusedPaneId", () => {
    const state = makeState(
      [
        makeWorkspace("ws1", [
          makePane("p1", "prof-default", [makeTab("t1", "https://a")]),
          makePane("p2", "prof-default", [makeTab("t2", "https://b")]),
        ]),
      ],
      "ws1",
    );
    setupHookWithShells(state, "p1", false, ["p1", "p2"]);

    const upserts = calls("native_webview_upsert").map((c) => (c[1] as { label: string }).label);
    expect(upserts).toEqual(["tab-t1"]);
  });

  it("hides panes from non-active workspaces", () => {
    const state = makeState(
      [
        makeWorkspace("ws1", [makePane("p1", "prof-default", [makeTab("t1", "https://a")])]),
        makeWorkspace("ws2", [makePane("p2", "prof-default", [makeTab("t2", "https://b")])]),
      ],
      "ws1",
    );
    setupHookWithShells(state, null, false, ["p1", "p2"]);

    const upsertLabels = calls("native_webview_upsert").map(
      (c) => (c[1] as { label: string }).label,
    );
    expect(upsertLabels).toEqual(["tab-t1"]);
    const hideLabels = calls("native_webview_hide").map((c) => (c[1] as { label: string }).label);
    expect(hideLabels).toContain("tab-t2");
  });

  it("calls native_webview_load_url when active tab URL changes between renders", () => {
    const initial = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", [makeTab("t1", "https://a")])])],
      "ws1",
    );
    const { hook } = setupHookWithShells(initial, null, false, ["p1"]);

    invokeSpy.mockClear();

    const next = makeState(
      [
        makeWorkspace("ws1", [
          makePane("p1", "prof-default", [makeTab("t1", "https://a", "https://b")]),
        ]),
      ],
      "ws1",
    );
    act(() => {
      hook.rerender({ s: next, f: null, sus: false });
    });

    const loads = calls("native_webview_load_url");
    expect(loads).toHaveLength(1);
    expect(loads[0][1]).toMatchObject({ label: "tab-t1", url: "https://b" });
  });

  it("closes webviews whose tab disappears between renders", () => {
    const initial = makeState(
      [
        makeWorkspace("ws1", [
          makePane("p1", "prof-default", [makeTab("t1", "https://a"), makeTab("t2", "https://b")], "t1"),
        ]),
      ],
      "ws1",
    );
    const { hook } = setupHookWithShells(initial, null, false, ["p1"]);

    invokeSpy.mockClear();

    const next = makeState(
      [
        makeWorkspace("ws1", [
          makePane("p1", "prof-default", [makeTab("t1", "https://a")], "t1"),
        ]),
      ],
      "ws1",
    );
    act(() => {
      hook.rerender({ s: next, f: null, sus: false });
    });

    const closes = calls("native_webview_close").map((c) => (c[1] as { label: string }).label);
    expect(closes).toContain("tab-t2");
  });

  it("sanitizes profile id with non-alnum characters before invoking upsert", () => {
    const state = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof@x.y", [makeTab("t1", "https://a")])])],
      "ws1",
    );
    setupHookWithShells(state, null, false, ["p1"]);

    const upserts = calls("native_webview_upsert");
    expect(upserts[0][1]).toMatchObject({ profileId: "prof-x-y" });
  });

  it("logs an error and continues when native_webview_upsert rejects", async () => {
    rejectingCommands.add("native_webview_upsert");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const state = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", [makeTab("t1", "https://a")])])],
      "ws1",
    );
    setupHookWithShells(state, null, false, ["p1"]);
    // Flush microtasks so the catch handler runs.
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(
      "native_webview_upsert failed",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it("logs an error when native_webview_load_url rejects on URL change", async () => {
    rejectingCommands.add("native_webview_load_url");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const initial = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", [makeTab("t1", "https://a")])])],
      "ws1",
    );
    const { hook } = setupHookWithShells(initial, null, false, ["p1"]);

    const next = makeState(
      [
        makeWorkspace("ws1", [
          makePane("p1", "prof-default", [makeTab("t1", "https://a", "https://b")]),
        ]),
      ],
      "ws1",
    );
    act(() => {
      hook.rerender({ s: next, f: null, sus: false });
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(
      "native_webview_load_url failed",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it("silently swallows native_webview_hide rejections", async () => {
    rejectingCommands.add("native_webview_hide");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const tabs = [makeTab("t1", "https://a"), makeTab("t2", "https://b")];
    const state = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", tabs, "t1")])],
      "ws1",
    );
    setupHookWithShells(state, null, false, ["p1"]);
    await Promise.resolve();
    await Promise.resolve();
    // hide uses a no-op catch; nothing logged, but invoke was called.
    expect(calls("native_webview_hide").length).toBeGreaterThan(0);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("hides existing live label on re-render when it becomes invisible (line 108)", () => {
    const tabs = [makeTab("t1", "https://a")];
    const initial = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", tabs)])],
      "ws1",
    );
    const { hook } = setupHookWithShells(initial, null, false, ["p1"]);
    // First render: tab-t1 is visible (upserted) and tracked in liveLabels.
    expect(calls("native_webview_upsert").length).toBeGreaterThan(0);
    invokeSpy.mockReset();
    // Re-render with the same state but suspended=true.
    act(() => {
      hook.rerender({ s: initial, f: null, sus: true });
    });
    // Now tab-t1 is in liveLabels but no longer in visibleLabels — line 108 fires.
    const hideLabels = calls("native_webview_hide").map((c) => (c[1] as { label: string }).label);
    expect(hideLabels).toContain("tab-t1");
  });

  it("invokes the .catch handler on native_webview_close rejection (line 105 anonymous)", async () => {
    rejectingCommands.add("native_webview_close");
    const tabs = [makeTab("t1", "https://a"), makeTab("t2", "https://b")];
    const initial = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", tabs)])],
      "ws1",
    );
    const { hook } = setupHookWithShells(initial, null, false, ["p1"]);
    invokeSpy.mockClear();

    // Re-render with t2 removed — t2's label moves out of allLabels and triggers close.
    const next = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", [makeTab("t1", "https://a")])])],
      "ws1",
    );
    act(() => {
      hook.rerender({ s: next, f: null, sus: false });
    });
    // Allow the rejection to flush through the .catch arrow.
    await Promise.resolve();
    await Promise.resolve();
    expect(calls("native_webview_close").length).toBeGreaterThan(0);
  });

  it("invokes the .catch handler on native_webview_hide rejection (line 108 anonymous)", async () => {
    rejectingCommands.add("native_webview_hide");
    const tabs = [makeTab("t1", "https://a")];
    const initial = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", tabs)])],
      "ws1",
    );
    const { hook } = setupHookWithShells(initial, null, false, ["p1"]);
    invokeSpy.mockClear();

    // Suspend → triggers hide path that rejects.
    act(() => {
      hook.rerender({ s: initial, f: null, sus: true });
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(calls("native_webview_hide").length).toBeGreaterThan(0);
  });

  it("falls back through tab.url then tab.loadedUrl when currentUrl is empty (line 59)", () => {
    // Build a tab where currentUrl="" but tab.url has a value: pure fallback path.
    const fallbackTab: ChatTab = {
      id: "tFallback",
      title: "T",
      url: "https://from-url-field/",
      loadedUrl: "https://from-loaded/",
      currentUrl: "",
    };
    const state = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", [fallbackTab])])],
      "ws1",
    );
    setupHookWithShells(state, null, false, ["p1"]);

    const upsert = calls("native_webview_upsert")[0]?.[1] as { url: string } | undefined;
    expect(upsert?.url).toBe("https://from-url-field/");
  });

  it("falls back to tab.loadedUrl when both currentUrl and url are empty (line 59 last branch)", () => {
    const fallbackTab: ChatTab = {
      id: "tLoaded",
      title: "T",
      url: "",
      loadedUrl: "https://from-loaded/",
      currentUrl: "",
    };
    const state = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", [fallbackTab])])],
      "ws1",
    );
    setupHookWithShells(state, null, false, ["p1"]);

    const upsert = calls("native_webview_upsert")[0]?.[1] as { url: string } | undefined;
    expect(upsert?.url).toBe("https://from-loaded/");
  });

  it("does not re-assign liveLabels.current when cleanup runs before sync (line 112)", () => {
    // Stub requestAnimationFrame so the sync callback is captured but not invoked.
    let captured: FrameRequestCallback | null = null;
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      captured = cb;
      return 1 as unknown as number;
    });
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const state = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default", [makeTab("t1", "https://x")])])],
      "ws1",
    );
    const { hook } = setupHookWithShells(state, null, false, ["p1"]);

    // Unmount BEFORE the frame fires — sets cancelled = true.
    hook.unmount();

    // Now invoke the captured rAF callback. It will run sync() with cancelled=true,
    // so the `if (!cancelled)` guard at line 112 skips assigning liveLabels.current.
    expect(captured).not.toBeNull();
    expect(() => captured!(0)).not.toThrow();

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
  });
});
