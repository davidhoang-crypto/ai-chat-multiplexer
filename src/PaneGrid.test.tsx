import { describe, expect, it, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useRef } from "react";
import type { MutableRefObject } from "react";

// Mock Pane to avoid pulling in its deep dependency tree (Tauri webview, drag handlers, etc.)
vi.mock("./components/Pane", () => ({
  Pane: (props: {
    pane: { id: string; title: string };
    index: number;
    registerShellRef?: (paneId: string, element: HTMLDivElement | null) => void;
  }) => (
    <div data-testid="pane" data-id={props.pane.id} data-index={props.index}>
      <div
        ref={(element) => props.registerShellRef?.(props.pane.id, element)}
      />
      {props.pane.title}
    </div>
  ),
}));

import { PaneGrid, type PaneGridProps } from "./components/PaneGrid";
import type { ChatPane } from "./appCore";

afterEach(cleanup);

function makePane(id: string): ChatPane {
  return {
    id,
    title: `Title-${id}`,
    profileId: "prof-default",
    activeTabId: `${id}-t`,
    tabs: [
      {
        id: `${id}-t`,
        title: "T",
        url: "https://x",
        loadedUrl: "https://x",
      },
    ],
  };
}

function harnessProps(panes: ChatPane[], overrides: Partial<PaneGridProps> = {}) {
  return {
    panes,
    overrides,
  };
}

function Harness({
  panes,
  overrides,
}: {
  panes: ChatPane[];
  overrides: Partial<PaneGridProps>;
}) {
  const paneDrag = useRef(null) as MutableRefObject<PaneGridProps["paneDrag"]["current"]>;
  const tabDrag = useRef(null) as MutableRefObject<PaneGridProps["tabDrag"]["current"]>;
  const webviewShells = useRef<Record<string, HTMLDivElement | null>>(
    {},
  ) as MutableRefObject<Record<string, HTMLDivElement | null>>;

  const props: PaneGridProps = {
    visiblePanes: panes,
    activePanes: panes,
    effectiveColumns: 2,
    focusedPaneId: null,
    dragOverPaneId: null,
    draggingTabKey: null,
    tabDragOver: null,
    editingUrls: {},
    paneDrag,
    tabDrag,
    webviewShells,
    getProfileById: () => ({ id: "prof-default", name: "Default" }),
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
  return <PaneGrid {...props} />;
}

describe("PaneGrid", () => {
  it("renders one Pane per visiblePane in the supplied order", () => {
    const panes = [makePane("p1"), makePane("p2"), makePane("p3")];
    const { container } = render(<Harness {...harnessProps(panes)} />);
    const ids = Array.from(container.querySelectorAll("[data-testid=pane]")).map(
      (el) => el.getAttribute("data-id"),
    );
    expect(ids).toEqual(["p1", "p2", "p3"]);
  });

  it("passes the correct index prop to each Pane", () => {
    const panes = [makePane("a"), makePane("b")];
    const { container } = render(<Harness {...harnessProps(panes)} />);
    const indices = Array.from(container.querySelectorAll("[data-testid=pane]")).map(
      (el) => el.getAttribute("data-index"),
    );
    expect(indices).toEqual(["0", "1"]);
  });

  it("applies the columns-N modifier class based on effectiveColumns", () => {
    const panes = [makePane("p1")];
    const { container } = render(
      <Harness panes={panes} overrides={{ effectiveColumns: 3 }} />,
    );
    const grid = container.querySelector(".split-grid")!;
    expect(grid.className).toContain("columns-3");
    expect(grid.className).not.toContain("focus-mode");
  });

  it("adds focus-mode class when focusedPaneId is set", () => {
    const panes = [makePane("p1")];
    const { container } = render(
      <Harness panes={panes} overrides={{ focusedPaneId: "p1" }} />,
    );
    const grid = container.querySelector(".split-grid")!;
    expect(grid.className).toContain("focus-mode");
  });

  it("renders an empty grid when visiblePanes is empty", () => {
    const { container } = render(<Harness panes={[]} overrides={{}} />);
    const grid = container.querySelector(".split-grid")!;
    expect(grid.children).toHaveLength(0);
  });

  it("only renders panes from visiblePanes (not activePanes when they differ)", () => {
    const all = [makePane("p1"), makePane("p2")];
    const visible = [all[0]];
    const { container } = render(
      <Harness panes={visible} overrides={{ activePanes: all }} />,
    );
    const ids = Array.from(container.querySelectorAll("[data-testid=pane]")).map(
      (el) => el.getAttribute("data-id"),
    );
    expect(ids).toEqual(["p1"]);
  });

  it("registers shell refs for each pane in webviewShells.current", () => {
    let capturedRef: MutableRefObject<Record<string, HTMLDivElement | null>> | null = null;
    function CapturingHarness() {
      const paneDrag = useRef(null) as MutableRefObject<PaneGridProps["paneDrag"]["current"]>;
      const tabDrag = useRef(null) as MutableRefObject<PaneGridProps["tabDrag"]["current"]>;
      const webviewShells = useRef<Record<string, HTMLDivElement | null>>(
        {},
      ) as MutableRefObject<Record<string, HTMLDivElement | null>>;
      capturedRef = webviewShells;
      const panes = [makePane("p1"), makePane("p2")];
      const props: PaneGridProps = {
        visiblePanes: panes,
        activePanes: panes,
        effectiveColumns: 2,
        focusedPaneId: null,
        dragOverPaneId: null,
        draggingTabKey: null,
        tabDragOver: null,
        editingUrls: {},
        paneDrag,
        tabDrag,
        webviewShells,
        getProfileById: () => ({ id: "prof-default", name: "Default" }),
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
      };
      return <PaneGrid {...props} />;
    }
    render(<CapturingHarness />);
    expect(capturedRef).not.toBeNull();
    const refs = capturedRef!.current;
    expect(Object.keys(refs).sort()).toEqual(["p1", "p2"]);
    expect(refs.p1).not.toBeNull();
    expect(refs.p2).not.toBeNull();
  });
});
