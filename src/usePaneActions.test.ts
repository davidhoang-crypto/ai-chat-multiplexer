import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState, useRef } from "react";

const invokeSpy = vi.fn();
let tauriRuntime = false;
const rejectingCommands = new Set<string>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => {
    invokeSpy(cmd, args);
    if (rejectingCommands.has(cmd)) {
      return Promise.reject(new Error(`${cmd} forced rejection`));
    }
    return Promise.resolve();
  },
}));

vi.mock("./appCore", async () => {
  const actual = await vi.importActual<typeof import("./appCore")>("./appCore");
  return {
    ...actual,
    isTauriRuntime: () => tauriRuntime,
  };
});

import { usePaneActions } from "./hooks/usePaneActions";
import type { AppState, ChatPane, ChatTab } from "./appCore";

function makeTab(id: string, url = "https://example.com"): ChatTab {
  return { id, title: `Tab ${id}`, url, loadedUrl: url, currentUrl: url };
}

function makePane(id: string, profileId = "prof-default", tabs?: ChatTab[]): ChatPane {
  const realTabs = tabs ?? [makeTab(`${id}-t1`)];
  return {
    id,
    title: `Pane ${id}`,
    profileId,
    activeTabId: realTabs[0].id,
    tabs: realTabs,
  };
}

function makeState(panes: ChatPane[], columns = 2): AppState {
  return {
    workspaces: [{ id: "ws1", name: "W", columns, panes }],
    activeWorkspaceId: "ws1",
    profiles: [{ id: "prof-default", name: "Default" }],
  };
}

function setupHook(initialState: AppState) {
  const setDraggingPaneId = vi.fn();
  const setDragOverPaneId = vi.fn();
  const utils = renderHook(() => {
    const [state, setState] = useState<AppState>(initialState);
    const [editingUrls, setEditingUrls] = useState<Record<string, string>>({});
    const paneDrag = useRef<{
      paneId: string;
      pointerId: number;
      startX: number;
      startY: number;
      active: boolean;
    } | null>(null);
    const actions = usePaneActions({
      state,
      setState,
      focusedPaneId: null,
      paneDrag,
      editingUrls,
      setEditingUrls,
      setDraggingPaneId,
      setDragOverPaneId,
    });
    return { state, actions, setEditingUrls, editingUrls, paneDrag };
  });
  return Object.assign(utils, { setDraggingPaneId, setDragOverPaneId });
}

describe("usePaneActions", () => {
  beforeEach(() => {
    invokeSpy.mockReset();
    tauriRuntime = false;
    rejectingCommands.clear();
  });

  it("setColumns updates active workspace columns", () => {
    const { result } = setupHook(makeState([makePane("p1")], 2));
    act(() => result.current.actions.setColumns(4));
    expect(result.current.state.workspaces[0].columns).toBe(4);
  });

  it("addTab appends new tab and activates it", () => {
    const { result } = setupHook(makeState([makePane("p1")]));
    act(() => result.current.actions.addTab("p1"));
    const pane = result.current.state.workspaces[0].panes[0];
    expect(pane.tabs).toHaveLength(2);
    expect(pane.activeTabId).toBe(pane.tabs[1].id);
  });

  it("removeTab drops a tab and keeps activeTabId valid", () => {
    const tabs = [makeTab("t1"), makeTab("t2"), makeTab("t3")];
    const pane = makePane("p1", "prof-default", tabs);
    pane.activeTabId = "t2";
    const { result } = setupHook(makeState([pane]));

    act(() => result.current.actions.removeTab("p1", "t2"));
    const updated = result.current.state.workspaces[0].panes[0];
    expect(updated.tabs.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(updated.activeTabId).toBe("t1");
  });

  it("removeTab on the last tab replaces it with a fresh new-tab", () => {
    const pane = makePane("p1", "prof-default", [makeTab("t1")]);
    const { result } = setupHook(makeState([pane]));

    act(() => result.current.actions.removeTab("p1", "t1"));
    const updated = result.current.state.workspaces[0].panes[0];
    expect(updated.tabs).toHaveLength(1);
    expect(updated.tabs[0].id).not.toBe("t1");
  });

  it("removePane removes a pane (when more than one exists)", () => {
    const { result } = setupHook(makeState([makePane("p1"), makePane("p2")]));
    act(() => result.current.actions.removePane("p1"));
    const panes = result.current.state.workspaces[0].panes;
    expect(panes).toHaveLength(1);
    expect(panes[0].id).toBe("p2");
  });

  it("removePane is no-op when only one pane remains", () => {
    const { result } = setupHook(makeState([makePane("p1")]));
    act(() => result.current.actions.removePane("p1"));
    expect(result.current.state.workspaces[0].panes).toHaveLength(1);
  });

  it("moveTabWithinPane reorders tabs", () => {
    const tabs = [makeTab("t1"), makeTab("t2"), makeTab("t3")];
    const { result } = setupHook(makeState([makePane("p1", "prof-default", tabs)]));
    // Move t1 after t3 -> [t2, t3, t1]
    act(() => result.current.actions.moveTabWithinPane("p1", "t1", "t3", false));
    expect(
      result.current.state.workspaces[0].panes[0].tabs.map((t) => t.id),
    ).toEqual(["t2", "t3", "t1"]);
  });

  it("moveTabWithinPane is a no-op when source equals target", () => {
    const tabs = [makeTab("t1"), makeTab("t2")];
    const { result } = setupHook(makeState([makePane("p1", "prof-default", tabs)]));
    act(() => result.current.actions.moveTabWithinPane("p1", "t1", "t1", false));
    expect(
      result.current.state.workspaces[0].panes[0].tabs.map((t) => t.id),
    ).toEqual(["t1", "t2"]);
  });

  it("moveTabAcrossPanes moves a tab between panes with same profile", () => {
    const sourceTabs = [makeTab("t1"), makeTab("t2")];
    const targetTabs = [makeTab("t3")];
    const panes = [
      makePane("p1", "prof-default", sourceTabs),
      makePane("p2", "prof-default", targetTabs),
    ];
    const { result } = setupHook(makeState(panes));

    act(() => result.current.actions.moveTabAcrossPanes("p1", "t1", "p2", "t3", true));

    const [src, tgt] = result.current.state.workspaces[0].panes;
    expect(src.tabs.map((t) => t.id)).toEqual(["t2"]);
    expect(tgt.tabs.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(tgt.activeTabId).toBe("t1");
  });

  it("moveTabAcrossPanes refuses cross-profile moves", () => {
    const panes = [
      makePane("p1", "prof-A", [makeTab("t1"), makeTab("t2")]),
      makePane("p2", "prof-B", [makeTab("t3")]),
    ];
    const { result } = setupHook(makeState(panes));
    act(() => result.current.actions.moveTabAcrossPanes("p1", "t1", "p2", "t3", true));
    const [src, tgt] = result.current.state.workspaces[0].panes;
    expect(src.tabs.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(tgt.tabs.map((t) => t.id)).toEqual(["t3"]);
  });

  it("moveTabAcrossPanes refuses to empty source pane", () => {
    const panes = [
      makePane("p1", "prof-default", [makeTab("t1")]),
      makePane("p2", "prof-default", [makeTab("t2")]),
    ];
    const { result } = setupHook(makeState(panes));
    act(() => result.current.actions.moveTabAcrossPanes("p1", "t1", "p2", null, false));
    const [src, tgt] = result.current.state.workspaces[0].panes;
    expect(src.tabs).toHaveLength(1);
    expect(tgt.tabs).toHaveLength(1);
  });

  it("moveTabAcrossPanes no-ops when source pane is missing (line 292 false branch)", () => {
    const panes = [
      makePane("p1", "prof-default", [makeTab("t1"), makeTab("t2")]),
      makePane("p2", "prof-default", [makeTab("t3")]),
    ];
    const { result } = setupHook(makeState(panes));
    act(() =>
      result.current.actions.moveTabAcrossPanes("missing", "t1", "p2", "t3", true),
    );
    const [src, tgt] = result.current.state.workspaces[0].panes;
    expect(src.tabs.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(tgt.tabs.map((t) => t.id)).toEqual(["t3"]);
  });

  it("moveTabAcrossPanes no-ops when target pane is missing", () => {
    const panes = [
      makePane("p1", "prof-default", [makeTab("t1"), makeTab("t2")]),
      makePane("p2", "prof-default", [makeTab("t3")]),
    ];
    const { result } = setupHook(makeState(panes));
    act(() =>
      result.current.actions.moveTabAcrossPanes("p1", "t1", "missing", null, false),
    );
    const [src, tgt] = result.current.state.workspaces[0].panes;
    expect(src.tabs.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(tgt.tabs.map((t) => t.id)).toEqual(["t3"]);
  });

  it("detachTabToNewPane creates a new pane with the moved tab", () => {
    const panes = [makePane("p1", "prof-default", [makeTab("t1"), makeTab("t2")])];
    const { result } = setupHook(makeState(panes));

    act(() => result.current.actions.detachTabToNewPane("p1", "t2"));

    const ws = result.current.state.workspaces[0];
    expect(ws.panes).toHaveLength(2);
    expect(ws.panes[0].tabs.map((t) => t.id)).toEqual(["t1"]);
    expect(ws.panes[1].tabs.map((t) => t.id)).toEqual(["t2"]);
    expect(ws.panes[1].profileId).toBe("prof-default");
  });

  it("detachTabToNewPane refuses when source has only one tab", () => {
    const panes = [makePane("p1", "prof-default", [makeTab("t1")])];
    const { result } = setupHook(makeState(panes));
    act(() => result.current.actions.detachTabToNewPane("p1", "t1"));
    expect(result.current.state.workspaces[0].panes).toHaveLength(1);
  });

  it("detachTabToNewPane no-ops when source pane id does not exist (line 343)", () => {
    const panes = [makePane("p1", "prof-default", [makeTab("t1"), makeTab("t2")])];
    const { result } = setupHook(makeState(panes));
    act(() => result.current.actions.detachTabToNewPane("missing-pane", "t1"));
    expect(result.current.state.workspaces[0].panes).toHaveLength(1);
  });

  it("detachTabToNewPane no-ops when tab id does not exist in source (line 345)", () => {
    const panes = [makePane("p1", "prof-default", [makeTab("t1"), makeTab("t2")])];
    const { result } = setupHook(makeState(panes));
    act(() => result.current.actions.detachTabToNewPane("p1", "missing-tab"));
    expect(result.current.state.workspaces[0].panes).toHaveLength(1);
  });

  it("startEditingUrl seeds editingUrls with current display URL", () => {
    const tab = makeTab("t1", "https://abc.com");
    const { result } = setupHook(makeState([makePane("p1", "prof-default", [tab])]));
    act(() => result.current.actions.startEditingUrl("p1", tab));
    expect(Object.keys(result.current.editingUrls)).toHaveLength(1);
  });

  it("updateEditingUrl writes the editing draft for a tab key", () => {
    const tab = makeTab("t1");
    const { result } = setupHook(makeState([makePane("p1", "prof-default", [tab])]));
    act(() => result.current.actions.updateEditingUrl("p1", "t1", "github.com"));
    const values = Object.values(result.current.editingUrls);
    expect(values).toContain("github.com");
  });

  it("commitTabUrl with empty value resets the tab to a fresh new-tab page", () => {
    const tab = makeTab("t1", "https://abc.com");
    const { result } = setupHook(makeState([makePane("p1", "prof-default", [tab])]));
    act(() => result.current.actions.startEditingUrl("p1", tab));
    act(() => result.current.actions.updateEditingUrl("p1", "t1", "  "));
    act(() => result.current.actions.commitTabUrl("p1", "t1"));

    const updated = result.current.state.workspaces[0].panes[0].tabs[0];
    expect(updated.url).not.toBe("https://abc.com");
    expect(result.current.editingUrls).toEqual({});
  });

  it("commitTabUrl with a non-empty value resolves and assigns it", () => {
    const tab = makeTab("t1", "https://abc.com");
    const { result } = setupHook(makeState([makePane("p1", "prof-default", [tab])]));
    act(() => result.current.actions.startEditingUrl("p1", tab));
    act(() => result.current.actions.updateEditingUrl("p1", "t1", "https://example.org"));
    act(() => result.current.actions.commitTabUrl("p1", "t1"));

    const updated = result.current.state.workspaces[0].panes[0].tabs[0];
    expect(updated.url).toBe("https://example.org");
    expect(updated.loadedUrl).toBe("https://example.org");
    expect(updated.isLoading).toBe(true);
  });

  it("commitTabUrl is a no-op when there is no edited draft for the tab", () => {
    const tab = makeTab("t1", "https://abc.com");
    const { result } = setupHook(makeState([makePane("p1", "prof-default", [tab])]));
    // No startEditingUrl call → draftUrl is undefined.
    act(() => result.current.actions.commitTabUrl("p1", "t1"));
    const updated = result.current.state.workspaces[0].panes[0].tabs[0];
    expect(updated.url).toBe("https://abc.com");
  });

  it("commitTabUrl leaves other tabs in the pane unchanged", () => {
    const tab1 = makeTab("t1", "https://one.com");
    const tab2 = makeTab("t2", "https://two.com");
    const { result } = setupHook(
      makeState([makePane("p1", "prof-default", [tab1, tab2])]),
    );
    act(() => result.current.actions.startEditingUrl("p1", tab1));
    act(() => result.current.actions.updateEditingUrl("p1", "t1", "https://new.com"));
    act(() => result.current.actions.commitTabUrl("p1", "t1"));
    const tabs = result.current.state.workspaces[0].panes[0].tabs;
    expect(tabs[0].url).toBe("https://new.com");
    // tab2 should be returned untouched (covers the early-return branch in the map).
    expect(tabs[1].url).toBe("https://two.com");
  });

  it("moveTabWithinPane appends the source tab when the target id is missing", () => {
    const tabA = makeTab("a");
    const tabB = makeTab("b");
    const tabC = makeTab("c");
    const { result } = setupHook(
      makeState([makePane("p1", "prof-default", [tabA, tabB, tabC])]),
    );
    // Provide a target id that does not exist in the pane → adjustedTarget < 0
    // and the source tab is pushed to the end (line 272).
    act(() => result.current.actions.moveTabWithinPane("p1", "a", "missing-target", true));
    const ids = result.current.state.workspaces[0].panes[0].tabs.map((t) => t.id);
    expect(ids).toEqual(["b", "c", "a"]);
  });

  it("finishPaneDrag with no active drag does nothing to pane order", () => {
    const { result } = setupHook(
      makeState([makePane("p1"), makePane("p2"), makePane("p3")]),
    );
    act(() => result.current.actions.finishPaneDrag(0, 0));
    expect(result.current.state.workspaces[0].panes.map((p) => p.id)).toEqual([
      "p1",
      "p2",
      "p3",
    ]);
  });

  it("finishPaneDrag reorders panes when dropped on another pane", () => {
    const hook = setupHook(makeState([makePane("p1"), makePane("p2"), makePane("p3")]));
    const { result } = hook;
    // Mark drag active for p1
    act(() => {
      result.current.paneDrag.current = {
        paneId: "p1",
        pointerId: 1,
        startX: 0,
        startY: 0,
        active: true,
      };
    });
    // Stub elementFromPoint to return a node with [data-pane-id="p3"]
    const node = document.createElement("div");
    node.setAttribute("data-pane-id", "p3");
    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => Element }).elementFromPoint = () =>
      node;

    try {
      act(() => result.current.actions.finishPaneDrag(0, 0));
      expect(result.current.state.workspaces[0].panes.map((p) => p.id)).toEqual([
        "p2",
        "p3",
        "p1",
      ]);
      expect(hook.setDraggingPaneId).toHaveBeenCalledWith(null);
      expect(hook.setDragOverPaneId).toHaveBeenCalledWith(null);
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint =
        original;
    }
  });

  it("finishPaneDrag clears state but does not reorder when target equals source", () => {
    const hook = setupHook(makeState([makePane("p1"), makePane("p2"), makePane("p3")]));
    const { result } = hook;
    act(() => {
      result.current.paneDrag.current = {
        paneId: "p1",
        pointerId: 1,
        startX: 0,
        startY: 0,
        active: true,
      };
    });
    const node = document.createElement("div");
    node.setAttribute("data-pane-id", "p1");
    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => Element }).elementFromPoint = () =>
      node;
    try {
      act(() => result.current.actions.finishPaneDrag(0, 0));
      expect(result.current.state.workspaces[0].panes.map((p) => p.id)).toEqual([
        "p1",
        "p2",
        "p3",
      ]);
      expect(hook.setDraggingPaneId).toHaveBeenCalledWith(null);
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint =
        original;
    }
  });

  it("moveTabWithinPane no-ops when source equals target tab id", () => {
    const tabs = [makeTab("t1"), makeTab("t2")];
    const { result } = setupHook(makeState([makePane("p1", "prof-default", tabs)]));
    act(() => result.current.actions.moveTabWithinPane("p1", "t1", "t1", true));
    expect(result.current.state.workspaces[0].panes[0].tabs.map((t) => t.id)).toEqual([
      "t1",
      "t2",
    ]);
  });

  it("moveTabWithinPane is a no-op when source tab is missing from pane", () => {
    const tabs = [makeTab("t1"), makeTab("t2")];
    const { result } = setupHook(makeState([makePane("p1", "prof-default", tabs)]));
    act(() => result.current.actions.moveTabWithinPane("p1", "missing", "t2", true));
    expect(result.current.state.workspaces[0].panes[0].tabs.map((t) => t.id)).toEqual([
      "t1",
      "t2",
    ]);
  });

  it("moveTabAcrossPanes appends to target when targetTabId is not found", () => {
    const sourceTabs = [makeTab("a1"), makeTab("a2")];
    const targetTabs = [makeTab("b1"), makeTab("b2")];
    const { result } = setupHook(
      makeState([
        makePane("p1", "prof-default", sourceTabs),
        makePane("p2", "prof-default", targetTabs),
      ]),
    );
    act(() =>
      result.current.actions.moveTabAcrossPanes("p1", "a1", "p2", "missing", true),
    );
    const target = result.current.state.workspaces[0].panes[1];
    expect(target.tabs.map((t) => t.id)).toEqual(["b1", "b2", "a1"]);
  });

  it("moveTabAcrossPanes leaves uninvolved third panes untouched", () => {
    const sourceTabs = [makeTab("a1"), makeTab("a2")];
    const targetTabs = [makeTab("b1")];
    const otherTabs = [makeTab("c1"), makeTab("c2")];
    const { result } = setupHook(
      makeState([
        makePane("p1", "prof-default", sourceTabs),
        makePane("p2", "prof-default", targetTabs),
        makePane("p3", "prof-default", otherTabs),
      ]),
    );
    const beforeP3 = result.current.state.workspaces[0].panes[2];
    act(() =>
      result.current.actions.moveTabAcrossPanes("p1", "a2", "p2", null, false),
    );
    const panesAfter = result.current.state.workspaces[0].panes;
    // p3 is unchanged by the move (line 334 passthrough branch)
    expect(panesAfter[2]).toBe(beforeP3);
    // p1 lost a2; p2 gained a2.
    expect(panesAfter[0].tabs.map((t) => t.id)).toEqual(["a1"]);
    expect(panesAfter[1].tabs.map((t) => t.id)).toEqual(["b1", "a2"]);
  });

  it("navigateActiveWebview calls window.history.back outside Tauri", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const { result } = setupHook(makeState([makePane("p1")]));
    act(() =>
      result.current.actions.navigateActiveWebview("p1", makeTab("t1"), "back"),
    );
    expect(back).toHaveBeenCalled();
    back.mockRestore();
  });

  it("navigateActiveWebview calls window.history.forward outside Tauri", () => {
    const forward = vi
      .spyOn(window.history, "forward")
      .mockImplementation(() => undefined);
    const { result } = setupHook(makeState([makePane("p1")]));
    act(() =>
      result.current.actions.navigateActiveWebview("p1", makeTab("t1"), "forward"),
    );
    expect(forward).toHaveBeenCalled();
    forward.mockRestore();
  });

  it("navigateActiveWebview calls window.location.reload outside Tauri for reload action", () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
    try {
      const { result } = setupHook(makeState([makePane("p1")]));
      act(() =>
        result.current.actions.navigateActiveWebview("p1", makeTab("t1"), "reload"),
      );
      expect(reloadSpy).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it("navigateActiveWebview invokes native_webview_navigate inside Tauri runtime", () => {
    tauriRuntime = true;
    const { result } = setupHook(makeState([makePane("p1")]));
    act(() =>
      result.current.actions.navigateActiveWebview("p1", makeTab("t1"), "back"),
    );
    expect(invokeSpy).toHaveBeenCalledWith(
      "native_webview_navigate",
      expect.objectContaining({ action: "back" }),
    );
  });

  it("navigateActiveWebview swallows native_webview_navigate rejection (line 253)", async () => {
    tauriRuntime = true;
    rejectingCommands.add("native_webview_navigate");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setupHook(makeState([makePane("p1")]));
    act(() =>
      result.current.actions.navigateActiveWebview("p1", makeTab("t1"), "forward"),
    );
    // Allow the .catch microtask to run.
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(
      "native_webview_navigate failed",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it("movePane is a no-op when source and target are the same pane", () => {
    const { result } = setupHook(makeState([makePane("p1"), makePane("p2")]));
    const before = result.current.state.workspaces[0].panes.map((p) => p.id);
    act(() => result.current.actions.movePane("p1", "p1"));
    const after = result.current.state.workspaces[0].panes.map((p) => p.id);
    expect(after).toEqual(before);
  });

  it("movePane is a no-op when target pane does not exist", () => {
    const { result } = setupHook(makeState([makePane("p1"), makePane("p2")]));
    const before = result.current.state.workspaces[0].panes.map((p) => p.id);
    act(() => result.current.actions.movePane("p1", "missing"));
    const after = result.current.state.workspaces[0].panes.map((p) => p.id);
    expect(after).toEqual(before);
  });

  it("setColumns leaves non-active workspaces untouched (line 82 false branch)", () => {
    const baseState: AppState = {
      workspaces: [
        { id: "ws1", name: "W1", columns: 1, panes: [makePane("p1")] },
        { id: "ws2", name: "W2", columns: 3, panes: [makePane("p2")] },
      ],
      activeWorkspaceId: "ws1",
      profiles: [{ id: "prof-default", name: "Default" }],
    };
    const { result } = setupHook(baseState);
    act(() => result.current.actions.setColumns(5));
    expect(result.current.state.workspaces[0].columns).toBe(5);
    // Non-active workspace must be returned untouched (false branch).
    expect(result.current.state.workspaces[1].columns).toBe(3);
  });

  it("addTab leaves other panes in workspace untouched (line 90 false branch)", () => {
    const panes = [
      makePane("p1", "prof-default", [makeTab("t1")]),
      makePane("p2", "prof-default", [makeTab("u1")]),
    ];
    const { result } = setupHook(makeState(panes));
    const beforeP2 = result.current.state.workspaces[0].panes[1];
    act(() => result.current.actions.addTab("p1"));
    const after = result.current.state.workspaces[0].panes;
    // p1 was updated, p2 returned as-is (false branch).
    expect(after[0].tabs).toHaveLength(2);
    expect(after[1]).toBe(beforeP2);
  });

  it("removeTab on the only tab is a no-op when tab id does not match (line 133 true branch)", () => {
    const pane = makePane("p1", "prof-default", [makeTab("t1")]);
    const { result } = setupHook(makeState([pane]));
    const before = result.current.state.workspaces[0].panes[0];
    act(() => result.current.actions.removeTab("p1", "missing"));
    const after = result.current.state.workspaces[0].panes[0];
    // Pane should be returned as-is.
    expect(after).toBe(before);
  });

  it("removeTab keeps activeTabId when removing a different tab (line 156 false branch)", () => {
    const tabs = [makeTab("t1"), makeTab("t2"), makeTab("t3")];
    const pane = makePane("p1", "prof-default", tabs);
    pane.activeTabId = "t1"; // active is t1 — we remove t2 (different)
    const { result } = setupHook(makeState([pane]));
    act(() => result.current.actions.removeTab("p1", "t2"));
    const updated = result.current.state.workspaces[0].panes[0];
    expect(updated.activeTabId).toBe("t1");
    expect(updated.tabs.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("commitTabUrl empty leaves OTHER tabs in pane untouched (line 196 false branch)", () => {
    const tab1 = makeTab("t1", "https://one.com");
    const tab2 = makeTab("t2", "https://two.com");
    const { result } = setupHook(
      makeState([makePane("p1", "prof-default", [tab1, tab2])]),
    );
    act(() => result.current.actions.startEditingUrl("p1", tab1));
    act(() => result.current.actions.updateEditingUrl("p1", "t1", "   "));
    act(() => result.current.actions.commitTabUrl("p1", "t1"));
    const tabs = result.current.state.workspaces[0].panes[0].tabs;
    // Reset t1 to new tab, t2 untouched (false branch in inner map).
    expect(tabs[0].url).not.toBe("https://one.com");
    expect(tabs[1].url).toBe("https://two.com");
  });

  it("moveTabWithinPane reorders with before=true onto a valid target (line 274 true branch)", () => {
    const tabs = [makeTab("a"), makeTab("b"), makeTab("c")];
    const { result } = setupHook(makeState([makePane("p1", "prof-default", tabs)]));
    // Move c BEFORE a → [c, a, b]
    act(() => result.current.actions.moveTabWithinPane("p1", "c", "a", true));
    expect(
      result.current.state.workspaces[0].panes[0].tabs.map((t) => t.id),
    ).toEqual(["c", "a", "b"]);
  });

  it("moveTabAcrossPanes is a no-op when source and target panes are the same id (line 288 true branch)", () => {
    const sourceTabs = [makeTab("t1"), makeTab("t2")];
    const { result } = setupHook(
      makeState([makePane("p1", "prof-default", sourceTabs)]),
    );
    const beforePane = result.current.state.workspaces[0].panes[0];
    act(() =>
      result.current.actions.moveTabAcrossPanes("p1", "t1", "p1", "t2", true),
    );
    // Workspace must be returned untouched (early return at line 288).
    const afterPane = result.current.state.workspaces[0].panes[0];
    expect(afterPane).toBe(beforePane);
  });

  it("moveTabAcrossPanes refuses to move a missing tab id from a valid source (line 298 missing-tab branch)", () => {
    const panes = [
      makePane("p1", "prof-default", [makeTab("t1"), makeTab("t2")]),
      makePane("p2", "prof-default", [makeTab("u1")]),
    ];
    const { result } = setupHook(makeState(panes));
    act(() =>
      result.current.actions.moveTabAcrossPanes("p1", "missing-tab", "p2", "u1", true),
    );
    const [src, tgt] = result.current.state.workspaces[0].panes;
    expect(src.tabs.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(tgt.tabs.map((t) => t.id)).toEqual(["u1"]);
  });

  it("moveTabAcrossPanes inserts AFTER target when before=false (line 318 false branch)", () => {
    const panes = [
      makePane("p1", "prof-default", [makeTab("t1"), makeTab("t2")]),
      makePane("p2", "prof-default", [makeTab("u1"), makeTab("u2")]),
    ];
    const { result } = setupHook(makeState(panes));
    // Move t1 AFTER u1 → target tabs become [u1, t1, u2]
    act(() =>
      result.current.actions.moveTabAcrossPanes("p1", "t1", "p2", "u1", false),
    );
    const [, tgt] = result.current.state.workspaces[0].panes;
    expect(tgt.tabs.map((t) => t.id)).toEqual(["u1", "t1", "u2"]);
  });

  it("moveTabAcrossPanes preserves source activeTabId when removing a non-active tab (line 304-ish false)", () => {
    const sourceTabs = [makeTab("t1"), makeTab("t2")];
    const sourcePane = makePane("p1", "prof-default", sourceTabs);
    sourcePane.activeTabId = "t1"; // active=t1 — we move t2 (non-active)
    const targetPane = makePane("p2", "prof-default", [makeTab("u1")]);
    const { result } = setupHook(makeState([sourcePane, targetPane]));
    act(() =>
      result.current.actions.moveTabAcrossPanes("p1", "t2", "p2", "u1", false),
    );
    const [src] = result.current.state.workspaces[0].panes;
    // Source activeTabId stays t1 — false branch for the ternary.
    expect(src.activeTabId).toBe("t1");
    expect(src.tabs.map((t) => t.id)).toEqual(["t1"]);
  });

  it("detachTabToNewPane preserves source activeTabId when detaching a non-active tab (line 372 false branch)", () => {
    const tabs = [makeTab("t1"), makeTab("t2"), makeTab("t3")];
    const pane = makePane("p1", "prof-default", tabs);
    pane.activeTabId = "t1"; // active=t1 — detach t3
    const { result } = setupHook(makeState([pane]));
    act(() => result.current.actions.detachTabToNewPane("p1", "t3"));
    const ws = result.current.state.workspaces[0];
    expect(ws.panes[0].activeTabId).toBe("t1");
    expect(ws.panes[0].tabs.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(ws.panes[1].tabs.map((t) => t.id)).toEqual(["t3"]);
  });

  it("detachTabToNewPane leaves a third uninvolved pane untouched (line 372 false branch in panes.map)", () => {
    const sourceTabs = [makeTab("t1"), makeTab("t2")];
    const otherTabs = [makeTab("u1")];
    const sourcePane = makePane("p1", "prof-default", sourceTabs);
    const otherPane = makePane("p2", "prof-default", otherTabs);
    const { result } = setupHook(makeState([sourcePane, otherPane]));
    const beforeP2 = result.current.state.workspaces[0].panes[1];
    act(() => result.current.actions.detachTabToNewPane("p1", "t2"));
    const after = result.current.state.workspaces[0].panes;
    // p2 must be returned identity-equal (false branch in panes.map ternary).
    expect(after[1]).toBe(beforeP2);
    // Plus a new pane appended at the end.
    expect(after).toHaveLength(3);
    expect(after[2].tabs.map((t) => t.id)).toEqual(["t2"]);
  });

  it("detachTabToNewPane keeps source activeTabId when detaching a non-active tab AND has multiple panes (line 356 false branch)", () => {
    const sourceTabs = [makeTab("t1"), makeTab("t2"), makeTab("t3")];
    const sourcePane = makePane("p1", "prof-default", sourceTabs);
    sourcePane.activeTabId = "t2"; // active=t2 — detach t1 (non-active)
    const otherPane = makePane("p2", "prof-default", [makeTab("u1")]);
    const { result } = setupHook(makeState([sourcePane, otherPane]));
    act(() => result.current.actions.detachTabToNewPane("p1", "t1"));
    const ws = result.current.state.workspaces[0];
    // Source pane retains activeTabId t2 (false branch of the ternary).
    expect(ws.panes[0].activeTabId).toBe("t2");
    expect(ws.panes[0].tabs.map((t) => t.id)).toEqual(["t2", "t3"]);
  });

  it("detachTabToNewPane shifts activeTabId to remaining first tab when detaching the active tab (line 356 true branch)", () => {
    const sourceTabs = [makeTab("t1"), makeTab("t2"), makeTab("t3")];
    const sourcePane = makePane("p1", "prof-default", sourceTabs);
    sourcePane.activeTabId = "t1"; // active=t1 — detach t1 (active)
    const { result } = setupHook(makeState([sourcePane]));
    act(() => result.current.actions.detachTabToNewPane("p1", "t1"));
    const ws = result.current.state.workspaces[0];
    // After removing t1, remainingTabs[0] is t2 — that's the new activeTabId.
    expect(ws.panes[0].activeTabId).toBe("t2");
    expect(ws.panes[0].tabs.map((t) => t.id)).toEqual(["t2", "t3"]);
    expect(ws.panes[1].tabs.map((t) => t.id)).toEqual(["t1"]);
  });

  it("finishPaneDrag clears state when active drag has no target node (line 409 false branch)", () => {
    const hook = setupHook(makeState([makePane("p1"), makePane("p2"), makePane("p3")]));
    const { result } = hook;
    act(() => {
      result.current.paneDrag.current = {
        paneId: "p1",
        pointerId: 1,
        startX: 0,
        startY: 0,
        active: true,
      };
    });
    // Stub elementFromPoint → returns null (no element at point).
    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => Element | null }).elementFromPoint =
      () => null;
    try {
      act(() => result.current.actions.finishPaneDrag(0, 0));
      expect(result.current.state.workspaces[0].panes.map((p) => p.id)).toEqual([
        "p1",
        "p2",
        "p3",
      ]);
      expect(hook.setDraggingPaneId).toHaveBeenCalledWith(null);
      expect(hook.setDragOverPaneId).toHaveBeenCalledWith(null);
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint =
        original;
    }
  });
});
