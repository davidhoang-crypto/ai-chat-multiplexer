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

  it("pane pointermove below threshold does not activate or set drag state", () => {
    const props = buildProps();
    props.paneDrag.current = {
      paneId: "p1",
      pointerId: 7,
      startX: 100,
      startY: 100,
      active: false,
    };
    const { container } = render(<Pane {...props} />);
    const strip = container.querySelector(".tab-strip")!;
    fireEvent.pointerMove(strip, { pointerId: 7, clientX: 102, clientY: 101 });
    expect(props.paneDrag.current?.active).toBe(false);
    expect(props.setDraggingPaneId).not.toHaveBeenCalled();
    expect(props.setDragOverPaneId).not.toHaveBeenCalled();
  });

  it("pane pointermove above threshold activates and sets drag state with target pane", () => {
    const otherPane = makePane({ id: "p2", activeTabId: "t1", tabs: [{ id: "t1", title: "T", url: "https://x.test", loadedUrl: "https://x.test" }] });
    const props = buildProps({ activePanes: [makePane(), otherPane] });
    props.paneDrag.current = {
      paneId: "p1",
      pointerId: 7,
      startX: 0,
      startY: 0,
      active: false,
    };
    const target = document.createElement("div");
    target.setAttribute("data-pane-id", "p2");
    document.body.appendChild(target);
    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => Element }).elementFromPoint = () =>
      target;
    try {
      const { container } = render(<Pane {...props} />);
      const strip = container.querySelector(".tab-strip")!;
      fireEvent.pointerMove(strip, { pointerId: 7, clientX: 50, clientY: 50 });
      expect(props.paneDrag.current?.active).toBe(true);
      expect(props.setDraggingPaneId).toHaveBeenCalledWith("p1");
      expect(props.setDragOverPaneId).toHaveBeenCalledWith("p2");
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint =
        original;
      document.body.removeChild(target);
    }
  });

  it("pane pointermove resets dragOverPaneId to null when target equals source", () => {
    const props = buildProps();
    props.paneDrag.current = {
      paneId: "p1",
      pointerId: 7,
      startX: 0,
      startY: 0,
      active: true,
    };
    const target = document.createElement("div");
    target.setAttribute("data-pane-id", "p1");
    document.body.appendChild(target);
    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => Element }).elementFromPoint = () =>
      target;
    try {
      const { container } = render(<Pane {...props} />);
      const strip = container.querySelector(".tab-strip")!;
      fireEvent.pointerMove(strip, { pointerId: 7, clientX: 50, clientY: 50 });
      expect(props.setDragOverPaneId).toHaveBeenCalledWith(null);
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint =
        original;
      document.body.removeChild(target);
    }
  });

  it("tab pointermove on another tab in same pane sets tabDragOver with before flag", () => {
    const props = buildProps();
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t1",
      pointerId: 5,
      startX: 0,
      startY: 0,
      active: false,
    };
    const { container } = render(<Pane {...props} />);
    const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
    const tab2 = container.querySelector<HTMLElement>('[data-tab-id="t2"]')!;
    // Mock getBoundingClientRect for tab2 to known coords
    const rect = { left: 100, right: 200, top: 0, bottom: 30, width: 100, height: 30, x: 100, y: 0, toJSON: () => ({}) } as DOMRect;
    tab2.getBoundingClientRect = () => rect;

    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => HTMLElement }).elementFromPoint = () =>
      tab2;
    try {
      // Move past 6px threshold; cursor at clientX=120 → before midpoint (150) → before=true
      fireEvent.pointerMove(tab1, { pointerId: 5, clientX: 120, clientY: 5 });
      expect(props.setTabDragOver).toHaveBeenCalledWith({
        paneId: "p1",
        tabId: "t2",
        before: true,
      });

      // Move past midpoint → before=false
      (props.setTabDragOver as ReturnType<typeof vi.fn>).mockClear();
      fireEvent.pointerMove(tab1, { pointerId: 5, clientX: 180, clientY: 5 });
      expect(props.setTabDragOver).toHaveBeenCalledWith({
        paneId: "p1",
        tabId: "t2",
        before: false,
      });
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint =
        original;
    }
  });

  it("tab drop on tab-strip with no overlay does NOT detach the tab", () => {
    const props = buildProps();
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t1",
      pointerId: 8,
      startX: 0,
      startY: 0,
      active: true,
    };
    const tabStripStub = document.createElement("div");
    tabStripStub.classList.add("tab-strip");
    document.body.appendChild(tabStripStub);
    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => HTMLElement }).elementFromPoint = () =>
      tabStripStub;
    try {
      const { container } = render(<Pane {...props} />);
      const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
      fireEvent.pointerUp(tab1, { pointerId: 8, clientX: 0, clientY: 0 });
      expect(props.detachTabToNewPane).not.toHaveBeenCalled();
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint =
        original;
      document.body.removeChild(tabStripStub);
    }
  });

  it("tab pointermove over another pane's tab (same profile) sets cross-pane tabDragOver (line 298)", () => {
    const otherPane = makePane({
      id: "p2",
      profileId: "prof-a", // same profile → allow cross-pane drop
      activeTabId: "tx",
      tabs: [{ id: "tx", title: "Other", url: "https://o.test", loadedUrl: "https://o.test" }],
    });
    const props = buildProps({ activePanes: [makePane(), otherPane] });
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t1",
      pointerId: 9,
      startX: 0,
      startY: 0,
      active: true,
    };

    // Build a stub element with both [data-tab-id] and [data-pane-id] for cross-pane logic.
    const stub = document.createElement("div");
    stub.setAttribute("data-tab-id", "tx");
    stub.setAttribute("data-pane-id", "p2");
    const rect = {
      left: 100,
      right: 200,
      top: 0,
      bottom: 30,
      width: 100,
      height: 30,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
    stub.getBoundingClientRect = () => rect;
    document.body.appendChild(stub);

    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => HTMLElement }).elementFromPoint = () => stub;
    try {
      const { container } = render(<Pane {...props} />);
      const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
      // clientX past midpoint=150 → before=false
      fireEvent.pointerMove(tab1, { pointerId: 9, clientX: 180, clientY: 5 });
      expect(props.setTabDragOver).toHaveBeenCalledWith({
        paneId: "p2",
        tabId: "tx",
        before: false,
      });
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint = original;
      document.body.removeChild(stub);
    }
  });

  it("tab pointermove over another pane's empty tab-list (same profile) sets tabDragOver with tabId=null (lines 304-318)", () => {
    const otherPane = makePane({
      id: "p2",
      profileId: "prof-a",
      activeTabId: "tx",
      tabs: [{ id: "tx", title: "Other", url: "https://o.test", loadedUrl: "https://o.test" }],
    });
    const props = buildProps({ activePanes: [makePane(), otherPane] });
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t1",
      pointerId: 10,
      startX: 0,
      startY: 0,
      active: true,
    };

    // Stub a node that is INSIDE a tab-list AND a pane container, but NOT a tab itself.
    const paneContainer = document.createElement("div");
    paneContainer.setAttribute("data-pane-id", "p2");
    const tabList = document.createElement("div");
    tabList.classList.add("tab-list");
    const inner = document.createElement("div"); // some empty area inside the tab-list
    tabList.appendChild(inner);
    paneContainer.appendChild(tabList);
    document.body.appendChild(paneContainer);

    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => HTMLElement }).elementFromPoint = () => inner;
    try {
      const { container } = render(<Pane {...props} />);
      const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
      fireEvent.pointerMove(tab1, { pointerId: 10, clientX: 50, clientY: 5 });
      expect(props.setTabDragOver).toHaveBeenCalledWith({
        paneId: "p2",
        tabId: null,
        before: false,
      });
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint = original;
      document.body.removeChild(paneContainer);
    }
  });

  it("tab pointermove over another pane's tab-list with DIFFERENT profile resets tabDragOver to null (line 304-318 false branch)", () => {
    const otherPane = makePane({
      id: "p2",
      profileId: "prof-b", // different profile → block cross-pane drop
      activeTabId: "tx",
      tabs: [{ id: "tx", title: "Other", url: "https://o.test", loadedUrl: "https://o.test" }],
    });
    const props = buildProps({ activePanes: [makePane(), otherPane] });
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t1",
      pointerId: 11,
      startX: 0,
      startY: 0,
      active: true,
    };

    const paneContainer = document.createElement("div");
    paneContainer.setAttribute("data-pane-id", "p2");
    const tabList = document.createElement("div");
    tabList.classList.add("tab-list");
    const inner = document.createElement("div");
    tabList.appendChild(inner);
    paneContainer.appendChild(tabList);
    document.body.appendChild(paneContainer);

    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => HTMLElement }).elementFromPoint = () => inner;
    try {
      const { container } = render(<Pane {...props} />);
      const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
      fireEvent.pointerMove(tab1, { pointerId: 11, clientX: 50, clientY: 5 });
      // The if-condition fails (different profile) → falls through to setTabDragOver(null).
      expect(props.setTabDragOver).toHaveBeenCalledWith(null);
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint = original;
      document.body.removeChild(paneContainer);
    }
  });

  it("falls back to first tab when activeTabId does not match any tab (line 138 ?? branch)", () => {
    // Build a pane whose activeTabId points to a non-existent tab.
    const orphanPane = makePane({ activeTabId: "missing" });
    const props = buildProps({ pane: orphanPane });
    const { container } = render(<Pane {...props} />);
    // The URL input shows the activeTab's display URL — should be tabs[0]'s URL.
    const input = container.querySelector<HTMLInputElement>(".url-input")!;
    expect(input.value).toContain("a.test");
    // No active tab class anywhere because no tab.id matches "missing".
    const tabs = container.querySelectorAll(".tab");
    expect([...tabs].some((t) => t.className.includes("active"))).toBe(false);
  });

  it("applies tab-dragging className when draggingTabKey matches (line 228 truthy)", () => {
    const props = buildProps({ draggingTabKey: "p1:t1" });
    const { container } = render(<Pane {...props} />);
    const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
    expect(tab1.className).toContain("tab-dragging");
  });

  it("applies tab-drop-before className when tabDragOver matches with before=true (line 229 truthy)", () => {
    const props = buildProps({ tabDragOver: { paneId: "p1", tabId: "t1", before: true } });
    const { container } = render(<Pane {...props} />);
    const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
    expect(tab1.className).toContain("tab-drop-before");
  });

  it("applies tab-drop-after className when tabDragOver matches with before=false (line 230 truthy)", () => {
    const props = buildProps({ tabDragOver: { paneId: "p1", tabId: "t1", before: false } });
    const { container } = render(<Pane {...props} />);
    const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
    expect(tab1.className).toContain("tab-drop-after");
  });

  it("ignores pointerdown on tab when button !== 0 (line 236 truthy)", () => {
    const props = buildProps();
    const { container } = render(<Pane {...props} />);
    const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
    fireEvent.pointerDown(tab1, { button: 2, pointerId: 1, clientX: 0, clientY: 0 });
    expect(props.tabDrag.current).toBeNull();
  });

  it("ignores pointerdown on tab close button (line 238 truthy)", () => {
    const props = buildProps();
    const { container } = render(<Pane {...props} />);
    const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
    const closeBtn = tab1.querySelector<HTMLElement>(".tab-close")!;
    fireEvent.pointerDown(closeBtn, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    // closest('.tab-close') matches → early return → tabDrag stays null.
    expect(props.tabDrag.current).toBeNull();
  });

  it("tab pointermove ignores event when pointerId differs from drag pointerId (line 251 truthy via mismatch)", () => {
    const props = buildProps();
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t1",
      pointerId: 9,
      startX: 0,
      startY: 0,
      active: false,
    };
    const { container } = render(<Pane {...props} />);
    const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
    // pointerId 99 does NOT match drag.pointerId 9 → early return.
    fireEvent.pointerMove(tab1, { pointerId: 99, clientX: 1000, clientY: 1000 });
    expect(props.setDraggingTabKey).not.toHaveBeenCalled();
    expect(props.setTabDragOver).not.toHaveBeenCalled();
  });

  it("tab pointermove below threshold (distance < 6) keeps drag inactive (line 257)", () => {
    const props = buildProps();
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t1",
      pointerId: 9,
      startX: 50,
      startY: 50,
      active: false,
    };
    const { container } = render(<Pane {...props} />);
    const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
    // 2px movement — under 6 threshold → early return.
    fireEvent.pointerMove(tab1, { pointerId: 9, clientX: 51, clientY: 51 });
    expect(props.setDraggingTabKey).not.toHaveBeenCalled();
    expect(props.tabDrag.current?.active).toBe(false);
  });

  it("tab pointerup ignores event when pointerId differs (line 322 truthy via mismatch)", () => {
    const props = buildProps();
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t1",
      pointerId: 9,
      startX: 0,
      startY: 0,
      active: true,
    };
    const { container } = render(<Pane {...props} />);
    const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
    fireEvent.pointerUp(tab1, { pointerId: 77, clientX: 0, clientY: 0 });
    // Drag state must NOT have been cleared.
    expect(props.tabDrag.current).not.toBeNull();
    expect(props.setDraggingTabKey).not.toHaveBeenCalled();
  });

  it("tab pointermove over a cross-pane tab with DIFFERENT profile falls through to tab-list check (line 283 false branch)", () => {
    // Hover a tab that belongs to a different-profile pane: the inner if(...) fails,
    // skipping the early `return` so the function continues to the tab-list branch.
    const otherPane = makePane({
      id: "p2",
      profileId: "prof-b", // different profile → block intra-tab match
      activeTabId: "tx",
      tabs: [{ id: "tx", title: "Other", url: "https://o.test", loadedUrl: "https://o.test" }],
    });
    const props = buildProps({ activePanes: [makePane(), otherPane] });
    props.tabDrag.current = {
      paneId: "p1",
      tabId: "t1",
      pointerId: 12,
      startX: 0,
      startY: 0,
      active: true,
    };

    // Stub element with data-tab-id (tx) AND data-pane-id (p2) on the SAME node, NO tab-list ancestor.
    const stub = document.createElement("div");
    stub.setAttribute("data-tab-id", "tx");
    stub.setAttribute("data-pane-id", "p2");
    stub.getBoundingClientRect = () =>
      ({
        left: 100,
        right: 200,
        top: 0,
        bottom: 30,
        width: 100,
        height: 30,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(stub);

    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: () => HTMLElement }).elementFromPoint = () => stub;
    try {
      const { container } = render(<Pane {...props} />);
      const tab1 = container.querySelector<HTMLElement>('[data-tab-id="t1"]')!;
      fireEvent.pointerMove(tab1, { pointerId: 12, clientX: 180, clientY: 5 });
      // Inner if(...) is false → no setTabDragOver({...tx}) call. Falls through to tab-list
      // branch (no tab-list ancestor either), so final setTabDragOver(null) fires.
      const calls = (props.setTabDragOver as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).toContainEqual([null]);
      // The cross-pane setTabDragOver({paneId:"p2", tabId:"tx", ...}) must NOT have been called.
      expect(calls.some((c) => c[0]?.tabId === "tx")).toBe(false);
    } finally {
      (document as unknown as { elementFromPoint: typeof original }).elementFromPoint = original;
      document.body.removeChild(stub);
    }
  });
});
