import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState, useRef } from "react";

const invokeSpy = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeSpy(cmd, args),
}));

vi.mock("./appCore", async () => {
  const actual = await vi.importActual<typeof import("./appCore")>("./appCore");
  return {
    ...actual,
    isTauriRuntime: () => false,
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
  return renderHook(() => {
    const [state, setState] = useState<AppState>(initialState);
    const [editingUrls, setEditingUrls] = useState<Record<string, string>>({});
    const paneDrag = useRef<{
      paneId: string;
      pointerId: number;
      startX: number;
      startY: number;
      active: boolean;
    } | null>(null);
    const setDraggingPaneId = vi.fn();
    const setDragOverPaneId = vi.fn();
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
    return { state, actions, setEditingUrls, editingUrls };
  });
}

describe("usePaneActions", () => {
  beforeEach(() => {
    invokeSpy.mockReset();
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
});
