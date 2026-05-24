import { describe, expect, it } from "vitest";
import { useDerivedWorkspaceState } from "./hooks/useDerivedWorkspaceState";
import type { AppState, ChatPane, Workspace } from "./appCore";

function makePane(id: string): ChatPane {
  return {
    id,
    title: `Pane ${id}`,
    profileId: "prof-default",
    activeTabId: `${id}-tab1`,
    tabs: [
      {
        id: `${id}-tab1`,
        title: "Tab 1",
        url: "https://example.com",
        loadedUrl: "https://example.com",
      },
    ],
  };
}

function makeWorkspace(id: string, columns: number, panes: ChatPane[]): Workspace {
  return { id, name: `Workspace ${id}`, columns, panes };
}

function makeState(workspaces: Workspace[], activeId: string): AppState {
  return { workspaces, activeWorkspaceId: activeId, profiles: [] };
}

const idleFlags = {
  isNewPaneMenuOpen: false,
  isWorkspaceMenuOpen: false,
  isSettingsOpen: false,
  isDownloadsOpen: false,
  draggingPaneId: null,
  draggingTabKey: null,
  textPrompt: null,
  confirmDialog: null,
};

describe("useDerivedWorkspaceState", () => {
  it("selects active workspace by id", () => {
    const ws1 = makeWorkspace("ws1", 2, [makePane("p1")]);
    const ws2 = makeWorkspace("ws2", 3, [makePane("p2"), makePane("p3")]);
    const state = makeState([ws1, ws2], "ws2");

    const result = useDerivedWorkspaceState({
      state,
      focusedPaneId: null,
      ...idleFlags,
    });

    expect(result.activeWorkspace.id).toBe("ws2");
    expect(result.activePanes).toHaveLength(2);
  });

  it("falls back to first workspace when activeWorkspaceId not found", () => {
    const ws1 = makeWorkspace("ws1", 2, [makePane("p1")]);
    const state = makeState([ws1], "non-existent");

    const result = useDerivedWorkspaceState({
      state,
      focusedPaneId: null,
      ...idleFlags,
    });

    expect(result.activeWorkspace.id).toBe("ws1");
  });

  it("filters visiblePanes when a pane is focused", () => {
    const ws = makeWorkspace("ws1", 2, [makePane("p1"), makePane("p2"), makePane("p3")]);
    const state = makeState([ws], "ws1");

    const result = useDerivedWorkspaceState({
      state,
      focusedPaneId: "p2",
      ...idleFlags,
    });

    expect(result.visiblePanes).toHaveLength(1);
    expect(result.visiblePanes[0].id).toBe("p2");
  });

  it("returns all panes as visible when no pane is focused", () => {
    const ws = makeWorkspace("ws1", 2, [makePane("p1"), makePane("p2")]);
    const state = makeState([ws], "ws1");

    const result = useDerivedWorkspaceState({
      state,
      focusedPaneId: null,
      ...idleFlags,
    });

    expect(result.visiblePanes).toHaveLength(2);
  });

  it("forces effectiveColumns=1 in focus mode", () => {
    const ws = makeWorkspace("ws1", 4, [makePane("p1"), makePane("p2")]);
    const state = makeState([ws], "ws1");

    const result = useDerivedWorkspaceState({
      state,
      focusedPaneId: "p1",
      ...idleFlags,
    });

    expect(result.effectiveColumns).toBe(1);
  });

  it("clamps effectiveColumns to pane count when fewer panes than columns", () => {
    const ws = makeWorkspace("ws1", 5, [makePane("p1"), makePane("p2")]);
    const state = makeState([ws], "ws1");

    const result = useDerivedWorkspaceState({
      state,
      focusedPaneId: null,
      ...idleFlags,
    });

    expect(result.effectiveColumns).toBe(2);
  });

  it("uses workspace columns when more panes available", () => {
    const ws = makeWorkspace("ws1", 2, [makePane("p1"), makePane("p2"), makePane("p3"), makePane("p4")]);
    const state = makeState([ws], "ws1");

    const result = useDerivedWorkspaceState({
      state,
      focusedPaneId: null,
      ...idleFlags,
    });

    expect(result.effectiveColumns).toBe(2);
  });

  it("ensures effectiveColumns is at least 1 even with empty panes", () => {
    const ws = makeWorkspace("ws1", 3, []);
    const state = makeState([ws], "ws1");

    const result = useDerivedWorkspaceState({
      state,
      focusedPaneId: null,
      ...idleFlags,
    });

    expect(result.effectiveColumns).toBe(1);
  });

  it("does NOT suspend native webviews when all UI is idle", () => {
    const ws = makeWorkspace("ws1", 2, [makePane("p1")]);
    const state = makeState([ws], "ws1");

    const result = useDerivedWorkspaceState({
      state,
      focusedPaneId: null,
      ...idleFlags,
    });

    expect(result.shouldSuspendNativeWebviews).toBe(false);
  });

  it.each([
    ["isNewPaneMenuOpen", { isNewPaneMenuOpen: true }],
    ["isWorkspaceMenuOpen", { isWorkspaceMenuOpen: true }],
    ["isSettingsOpen", { isSettingsOpen: true }],
    ["isDownloadsOpen", { isDownloadsOpen: true }],
    ["draggingPaneId", { draggingPaneId: "p1" }],
    ["draggingTabKey", { draggingTabKey: "p1:t1" }],
    ["textPrompt", { textPrompt: { kind: "rename" } }],
    ["confirmDialog", { confirmDialog: { title: "Are you sure?" } }],
  ])("suspends native webviews when %s is active", (_label, override) => {
    const ws = makeWorkspace("ws1", 2, [makePane("p1")]);
    const state = makeState([ws], "ws1");

    const result = useDerivedWorkspaceState({
      state,
      focusedPaneId: null,
      ...idleFlags,
      ...override,
    });

    expect(result.shouldSuspendNativeWebviews).toBe(true);
  });
});
