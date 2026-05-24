import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import type { MutableRefObject } from "react";

import { Pane, type PaneProps } from "./components/Pane";
import type { ChatPane } from "./appCore";

afterEach(() => {
  cleanup();
  (document.elementFromPoint as unknown) = undefined;
});

beforeEach(() => {
  vi.restoreAllMocks();
});

function makePane(overrides: Partial<ChatPane> = {}): ChatPane {
  return {
    id: "p1",
    title: "Pane One",
    profileId: "prof-a",
    activeTabId: "t1",
    tabs: [
      { id: "t1", title: "Tab 1", url: "https://a.test", loadedUrl: "https://a.test" },
      { id: "t2", title: "Tab 2", url: "https://b.test", loadedUrl: "https://b.test" },
    ],
    ...overrides,
  };
}

function buildProps(overrides: Partial<PaneProps> = {}): PaneProps {
  const paneDragRef = { current: null } as PaneProps["paneDrag"];
  const tabDragRef = { current: null } as PaneProps["tabDrag"];
  const pane = (overrides.pane as ChatPane) ?? makePane();
  return {
    pane,
    index: 0,
    paneProfile: { id: "prof-a", name: "Alpha" },
    activePanes: [pane],
    isFocused: false,
    focusedPaneId: null,
    dragOverPaneId: null,
    draggingTabKey: null,
    tabDragOver: null,
    editingUrls: {},
    paneDrag: paneDragRef as MutableRefObject<PaneProps["paneDrag"]["current"]>,
    tabDrag: tabDragRef as MutableRefObject<PaneProps["tabDrag"]["current"]>,
    registerShellRef: vi.fn(),
    setFocusedPaneId: vi.fn(),
    setDraggingPaneId: vi.fn(),
    setDragOverPaneId: vi.fn(),
    setDraggingTabKey: vi.fn(),
    setTabDragOver: vi.fn(),
    setEditingUrls: vi.fn(),
    addTab: vi.fn(),
    removeTab: vi.fn(),
    removePane: vi.fn(),
    updateActivePane: vi.fn(),
    navigateActiveWebview: vi.fn(),
    startEditingUrl: vi.fn(),
    updateEditingUrl: vi.fn(),
    commitTabUrl: vi.fn(),
    finishPaneDrag: vi.fn(),
    moveTabWithinPane: vi.fn(),
    moveTabAcrossPanes: vi.fn(),
    detachTabToNewPane: vi.fn(),
    ...overrides,
  };
}

describe("Pane drag interactions", () => {
  it("pane drag: pointerdown on tab-strip seeds paneDrag.current", () => {
    const props = buildProps();
    const { container } = render(<Pane {...props} />);
    const strip = container.querySelector(".tab-strip")!;
    fireEvent.pointerDown(strip, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    expect(props.paneDrag.current).toMatchObject({
      paneId: "p1",
      pointerId: 1,
      startX: 10,
      startY: 10,
      active: false,
    });
  });

  it("pane drag: ignores pointerdown on a drag-control element", () => {
    const props = buildProps();
    const { container } = render(<Pane {...props} />);
    const strip = container.querySelector(".tab-strip")!;
    // The plus button (within .tab-actions) is a "pane drag control" per isPaneDragControl
    const plus = strip.querySelector('button[aria-label="Thêm tab"]')!;
    fireEvent.pointerDown(plus, {
      button: 0,
      pointerId: 1,
      clientX: 5,
      clientY: 5,
      bubbles: true,
    });
    expect(props.paneDrag.current).toBeNull();
  });

  it("pane drag: pointerup calls finishPaneDrag with cursor coords", () => {
    const props = buildProps();
    const { container } = render(<Pane {...props} />);
    const strip = container.querySelector(".tab-strip")!;
    fireEvent.pointerUp(strip, { pointerId: 1, clientX: 50, clientY: 60 });
    expect(props.finishPaneDrag).toHaveBeenCalledWith(50, 60);
  });

  it("pane drag: pointercancel clears paneDrag and drag state", () => {
    const props = buildProps();
    props.paneDrag.current = {
      paneId: "p1",
      pointerId: 1,
      startX: 0,
      startY: 0,
      active: true,
    };
    const { container } = render(<Pane {...props} />);
    fireEvent.pointerCancel(container.querySelector(".tab-strip")!, { pointerId: 1 });
    expect(props.paneDrag.current).toBeNull();
    expect(props.setDraggingPaneId).toHaveBeenCalledWith(null);
    expect(props.setDragOverPaneId).toHaveBeenCalledWith(null);
  });

  it("tab click (no drag): pointerdown then pointerup switches active tab", () => {
    const props = buildProps();
    const { container } = render(<Pane {...props} />);
    const tab2 = container.querySelector<HTMLElement>('[data-tab-id="t2"]')!;
    fireEvent.pointerDown(tab2, { button: 0, pointerId: 7, clientX: 100, clientY: 10 });
    fireEvent.pointerUp(tab2, { pointerId: 7, clientX: 100, clientY: 10 });
    expect(props.updateActivePane).toHaveBeenCalledWith("p1", expect.any(Function));
    const updater = (props.updateActivePane as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(updater(props.pane)).toMatchObject({ activeTabId: "t2" });
    // moveTab callbacks should NOT fire on simple click
    expect(props.moveTabWithinPane).not.toHaveBeenCalled();
    expect(props.moveTabAcrossPanes).not.toHaveBeenCalled();
  });

  it("tab drop within same pane: calls moveTabWithinPane with overlay info", () => {
    const props = buildProps({
      tabDragOver: { paneId: "p1", tabId: "t1", before: true },
    });
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t2",
      pointerId: 9,
      startX: 0,
      startY: 0,
      active: true,
    };
    const { container } = render(<Pane {...props} />);
    const tab2 = container.querySelector<HTMLElement>('[data-tab-id="t2"]')!;
    fireEvent.pointerUp(tab2, { pointerId: 9, clientX: 0, clientY: 0 });
    expect(props.moveTabWithinPane).toHaveBeenCalledWith("p1", "t2", "t1", true);
    expect(props.tabDrag.current).toBeNull();
    expect(props.setDraggingTabKey).toHaveBeenCalledWith(null);
    expect(props.setTabDragOver).toHaveBeenCalledWith(null);
  });

  it("tab drop across panes onto another tab: calls moveTabAcrossPanes", () => {
    const props = buildProps({
      tabDragOver: { paneId: "p2", tabId: "tx", before: false },
    });
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t2",
      pointerId: 9,
      startX: 0,
      startY: 0,
      active: true,
    };
    const { container } = render(<Pane {...props} />);
    const tab2 = container.querySelector<HTMLElement>('[data-tab-id="t2"]')!;
    fireEvent.pointerUp(tab2, { pointerId: 9, clientX: 0, clientY: 0 });
    expect(props.moveTabAcrossPanes).toHaveBeenCalledWith("p1", "t2", "p2", "tx", false);
  });

  it("tab drop on empty tab-list of another pane: calls moveTabAcrossPanes with null target", () => {
    const props = buildProps({
      tabDragOver: { paneId: "p2", tabId: null, before: false },
    });
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t2",
      pointerId: 9,
      startX: 0,
      startY: 0,
      active: true,
    };
    const { container } = render(<Pane {...props} />);
    const tab2 = container.querySelector<HTMLElement>('[data-tab-id="t2"]')!;
    fireEvent.pointerUp(tab2, { pointerId: 9, clientX: 0, clientY: 0 });
    expect(props.moveTabAcrossPanes).toHaveBeenCalledWith("p1", "t2", "p2", null, false);
  });

  it("tab drop outside any tab-strip: calls detachTabToNewPane (tear-out)", () => {
    const props = buildProps();
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t2",
      pointerId: 9,
      startX: 0,
      startY: 0,
      active: true,
    };
    // No overlay set → no tabDragOver. Stub elementFromPoint to return a node OUTSIDE .tab-strip
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => Element }).elementFromPoint = () =>
      outside;

    try {
      const { container } = render(<Pane {...props} />);
      const tab2 = container.querySelector<HTMLElement>('[data-tab-id="t2"]')!;
      fireEvent.pointerUp(tab2, { pointerId: 9, clientX: 999, clientY: 999 });
      expect(props.detachTabToNewPane).toHaveBeenCalledWith("p1", "t2");
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint =
        original;
      document.body.removeChild(outside);
    }
  });

  it("tab pointercancel clears tabDrag and drag state", () => {
    const props = buildProps();
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t2",
      pointerId: 9,
      startX: 0,
      startY: 0,
      active: true,
    };
    const { container } = render(<Pane {...props} />);
    const tab2 = container.querySelector<HTMLElement>('[data-tab-id="t2"]')!;
    fireEvent.pointerCancel(tab2, { pointerId: 9 });
    expect(props.tabDrag.current).toBeNull();
    expect(props.setDraggingTabKey).toHaveBeenCalledWith(null);
    expect(props.setTabDragOver).toHaveBeenCalledWith(null);
  });

  it("URL Escape key clears the editing override via setEditingUrls", () => {
    const props = buildProps({ editingUrls: { "p1:t1": "https://draft.test" } });
    const { container } = render(<Pane {...props} />);
    const input = container.querySelector<HTMLInputElement>(".url-input")!;
    fireEvent.keyDown(input, { key: "Escape" });
    expect(props.setEditingUrls).toHaveBeenCalledWith(expect.any(Function));
    const updater = (props.setEditingUrls as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater({ "p1:t1": "x", "other": "y" })).toEqual({ other: "y" });
  });
});
