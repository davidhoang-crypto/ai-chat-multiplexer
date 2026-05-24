import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup, within } from "@testing-library/react";
import type { MutableRefObject } from "react";

import { Pane, type PaneProps } from "./components/Pane";
import type { ChatPane } from "./appCore";

afterEach(cleanup);

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

function renderHarness(overrides: Partial<PaneProps> = {}) {
  const paneDragRef = { current: null } as PaneProps["paneDrag"];
  const tabDragRef = { current: null } as PaneProps["tabDrag"];
  const pane = (overrides.pane as ChatPane) ?? makePane();
  const props: PaneProps = {
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
  const utils = render(<Pane {...props} />);
  return { ...utils, props };
}

describe("Pane", () => {
  it("renders one button per tab and marks the active one", () => {
    const { container } = renderHarness();
    const tabButtons = container.querySelectorAll(".tab");
    expect(tabButtons).toHaveLength(2);
    expect(tabButtons[0].className).toContain("active");
    expect(tabButtons[1].className).not.toContain("active");
  });

  it("applies the accent-N class based on index", () => {
    const { container } = renderHarness({ index: 5 });
    expect(container.querySelector(".terminal-pane")!.className).toContain("accent-1");
  });

  it("adds pane-focused class when isFocused=true", () => {
    const { container } = renderHarness({ isFocused: true });
    expect(container.querySelector(".terminal-pane")!.className).toContain("pane-focused");
  });

  it("adds pane-drop-target class when dragOverPaneId matches pane.id", () => {
    const { container } = renderHarness({ dragOverPaneId: "p1" });
    expect(container.querySelector(".terminal-pane")!.className).toContain("pane-drop-target");
  });

  it("renders profile chip with paneProfile.name", () => {
    const { getByText } = renderHarness();
    expect(getByText("@Alpha")).toBeDefined();
  });

  it("does not render profile chip when paneProfile is undefined", () => {
    const { container } = renderHarness({ paneProfile: undefined });
    expect(container.querySelector(".profile-chip")).toBeNull();
  });

  it("calls addTab when the plus icon is clicked", () => {
    const { container, props } = renderHarness();
    fireEvent.click(container.querySelector('button[aria-label="Thêm tab"]')!);
    expect(props.addTab).toHaveBeenCalledWith("p1");
  });

  it("calls removePane when the close-pane button is clicked", () => {
    const { container, props } = renderHarness();
    fireEvent.click(container.querySelector('button[aria-label="Đóng split chat"]')!);
    expect(props.removePane).toHaveBeenCalledWith("p1");
  });

  it("toggles focus pane by calling setFocusedPaneId(pane.id) when not focused", () => {
    const { container, props } = renderHarness();
    fireEvent.click(container.querySelector('button[aria-label="Phóng to pane"]')!);
    expect(props.setFocusedPaneId).toHaveBeenCalledWith("p1");
  });

  it("toggles focus pane by calling setFocusedPaneId(null) when focused", () => {
    const { container, props } = renderHarness({ isFocused: true });
    fireEvent.click(container.querySelector('button[aria-label="Thu nhỏ pane"]')!);
    expect(props.setFocusedPaneId).toHaveBeenCalledWith(null);
  });

  it("calls removeTab when a tab close button is clicked", () => {
    const { container, props } = renderHarness();
    fireEvent.click(container.querySelector('[aria-label="Xóa Tab 2"]')!);
    expect(props.removeTab).toHaveBeenCalledWith("p1", "t2");
  });

  it("calls removeTab when Enter is pressed on the tab close span", () => {
    const { container, props } = renderHarness();
    const closer = container.querySelector('[aria-label="Xóa Tab 2"]') as HTMLElement;
    fireEvent.keyDown(closer, { key: "Enter" });
    expect(props.removeTab).toHaveBeenCalledWith("p1", "t2");
  });

  it("does NOT call removeTab when a non-Enter key is pressed on the tab close span", () => {
    const { container, props } = renderHarness();
    const closer = container.querySelector('[aria-label="Xóa Tab 2"]') as HTMLElement;
    fireEvent.keyDown(closer, { key: " " });
    expect(props.removeTab).not.toHaveBeenCalled();
  });

  it("calls navigateActiveWebview for back/forward/reload", () => {
    const { container, props } = renderHarness();
    fireEvent.click(container.querySelector('button[aria-label="Lùi"]')!);
    fireEvent.click(container.querySelector('button[aria-label="Tiến"]')!);
    fireEvent.click(container.querySelector('button[aria-label="Tải lại"]')!);
    expect(props.navigateActiveWebview).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ id: "t1" }),
      "back",
    );
    expect(props.navigateActiveWebview).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ id: "t1" }),
      "forward",
    );
    expect(props.navigateActiveWebview).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ id: "t1" }),
      "reload",
    );
  });

  it("URL input fires startEditingUrl on focus and updateEditingUrl on change", () => {
    const { container, props } = renderHarness();
    const input = container.querySelector<HTMLInputElement>(".url-input")!;
    fireEvent.focus(input);
    expect(props.startEditingUrl).toHaveBeenCalledWith("p1", expect.objectContaining({ id: "t1" }));
    fireEvent.change(input, { target: { value: "https://changed.test" } });
    expect(props.updateEditingUrl).toHaveBeenCalledWith("p1", "t1", "https://changed.test");
  });

  it("URL input fires commitTabUrl on blur", () => {
    const { container, props } = renderHarness();
    const input = container.querySelector<HTMLInputElement>(".url-input")!;
    fireEvent.blur(input);
    expect(props.commitTabUrl).toHaveBeenCalledWith("p1", "t1");
  });

  it("URL input blurs (committing) when Enter key is pressed", () => {
    const { container, props } = renderHarness();
    const input = container.querySelector<HTMLInputElement>(".url-input")!;
    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.commitTabUrl).toHaveBeenCalledWith("p1", "t1");
  });

  it("URL input shows editing override from editingUrls when present", () => {
    const { container } = renderHarness({
      editingUrls: { "p1:t1": "https://draft.test" },
    });
    const input = container.querySelector<HTMLInputElement>(".url-input")!;
    expect(input.value).toBe("https://draft.test");
  });

  it("renders Loading text and dot when active tab is loading", () => {
    const pane = makePane({
      tabs: [
        {
          id: "t1",
          title: "Tab 1",
          url: "https://a.test",
          loadedUrl: "https://a.test",
          isLoading: true,
        },
      ],
      activeTabId: "t1",
    });
    const { container } = renderHarness({ pane });
    const running = container.querySelector(".running")!;
    expect(within(running as HTMLElement).getByText("Loading")).toBeDefined();
    expect(running.querySelector(".live-dot")!.className).toContain("loading");
  });

  it("renders favicon when tab.faviconUrl is set and not loading", () => {
    const pane = makePane({
      tabs: [
        {
          id: "t1",
          title: "Tab 1",
          url: "https://a.test",
          loadedUrl: "https://a.test",
          faviconUrl: "https://a.test/favicon.ico",
        },
      ],
      activeTabId: "t1",
    });
    const { container } = renderHarness({ pane });
    const favicon = container.querySelector<HTMLImageElement>(".tab-favicon");
    expect(favicon).not.toBeNull();
    expect(favicon!.src).toContain("favicon.ico");
  });
});
