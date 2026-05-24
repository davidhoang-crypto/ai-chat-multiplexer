import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, cleanup, within } from "@testing-library/react";
import { WorkspaceSwitcher } from "./components/WorkspaceSwitcher";
import type { Workspace } from "./appCore";

afterEach(cleanup);

function makeWorkspace(id: string, name: string, paneCount: number): Workspace {
  return {
    id,
    name,
    columns: 1,
    panes: Array.from({ length: paneCount }, (_, i) => ({
      id: `${id}-p${i}`,
      title: "P",
      profileId: "prof-default",
      activeTabId: `${id}-p${i}-t`,
      tabs: [
        {
          id: `${id}-p${i}-t`,
          title: "T",
          url: "https://x",
          loadedUrl: "https://x",
        },
      ],
    })),
  };
}

function defaultProps(overrides: Partial<React.ComponentProps<typeof WorkspaceSwitcher>> = {}) {
  return {
    workspaces: [makeWorkspace("ws1", "First", 1), makeWorkspace("ws2", "Second", 0)],
    activeWorkspaceId: "ws1",
    activePaneCount: 1,
    open: true,
    onOpenChange: vi.fn(),
    onSwitch: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe("WorkspaceSwitcher", () => {
  it("renders active workspace name and pane count (singular)", () => {
    const { container } = render(<WorkspaceSwitcher {...defaultProps()} />);
    const summary = container.querySelector("summary")!;
    expect(within(summary as HTMLElement).getByText("First")).toBeDefined();
    expect(screen.getByText(/· 1 pane$/)).toBeDefined();
  });

  it("uses plural label when activePaneCount !== 1", () => {
    render(<WorkspaceSwitcher {...defaultProps({ activePaneCount: 3 })} />);
    expect(screen.getByText(/· 3 panes$/)).toBeDefined();
  });

  it("propagates open state via onOpenChange when details toggles", () => {
    const props = defaultProps({ open: false });
    const { container } = render(<WorkspaceSwitcher {...props} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    expect(props.onOpenChange).toHaveBeenCalledWith(true);
  });

  it("lists all workspaces in the menu", () => {
    render(<WorkspaceSwitcher {...defaultProps()} />);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("First")).toBeDefined();
    expect(within(menu).getByText("Second")).toBeDefined();
  });

  it("calls onSwitch then closes the menu when a workspace item is clicked", () => {
    const props = defaultProps();
    render(<WorkspaceSwitcher {...props} />);
    const menu = screen.getByRole("menu");
    fireEvent.click(within(menu).getByText("Second"));
    expect(props.onSwitch).toHaveBeenCalledWith("ws2");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onCreate then closes the menu", () => {
    const props = defaultProps();
    render(<WorkspaceSwitcher {...props} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /New workspace/ }));
    expect(props.onCreate).toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onRename when rename item is clicked", () => {
    const props = defaultProps();
    render(<WorkspaceSwitcher {...props} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /Rename current/ }));
    expect(props.onRename).toHaveBeenCalled();
  });

  it("calls onDelete when delete item is clicked", () => {
    const props = defaultProps();
    render(<WorkspaceSwitcher {...props} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete current/ }));
    expect(props.onDelete).toHaveBeenCalled();
  });

  it("disables the delete item when only one workspace exists", () => {
    const props = defaultProps({
      workspaces: [makeWorkspace("ws1", "Only", 0)],
      activeWorkspaceId: "ws1",
    });
    render(<WorkspaceSwitcher {...props} />);
    const del = screen.getByRole("menuitem", { name: /Delete current/ }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
  });

  it("falls back to first workspace when activeWorkspaceId is unknown", () => {
    const props = defaultProps({ activeWorkspaceId: "missing" });
    const { container } = render(<WorkspaceSwitcher {...props} />);
    const summary = container.querySelector("summary")!;
    expect(within(summary as HTMLElement).getByText("First")).toBeDefined();
  });
});
