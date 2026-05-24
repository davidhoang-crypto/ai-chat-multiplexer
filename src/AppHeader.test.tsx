import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { AppHeader, type AppHeaderProps } from "./components/AppHeader";
import type { AppState, Workspace } from "./appCore";

afterEach(cleanup);

function makeWorkspace(id: string, name: string, columns = 2): Workspace {
  return { id, name, columns, panes: [] };
}

function makeState(): AppState {
  return {
    workspaces: [makeWorkspace("ws1", "First", 2)],
    activeWorkspaceId: "ws1",
    profiles: [
      { id: "prof-default", name: "Default" },
      { id: "prof-x", name: "X" },
    ],
  };
}

function defaultProps(overrides: Partial<AppHeaderProps> = {}): AppHeaderProps {
  const state = makeState();
  return {
    state,
    activeWorkspace: state.workspaces[0],
    activePaneCount: 0,
    isWorkspaceMenuOpen: false,
    setIsWorkspaceMenuOpen: vi.fn(),
    switchWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
    renameActiveWorkspace: vi.fn(),
    deleteActiveWorkspace: vi.fn(),
    setColumns: vi.fn(),
    isNewPaneMenuOpen: true,
    setIsNewPaneMenuOpen: vi.fn(),
    addBlankPaneWithProfile: vi.fn(),
    renameProfile: vi.fn(),
    deleteProfile: vi.fn(),
    openTextPrompt: vi.fn(),
    ensureProfileWithName: vi.fn(),
    hasActiveDownload: false,
    setIsDownloadsOpen: vi.fn(),
    setIsSettingsOpen: vi.fn(),
    ...overrides,
  };
}

describe("AppHeader", () => {
  it("renders the layout segment with active column highlighted", () => {
    const props = defaultProps();
    props.activeWorkspace = makeWorkspace("ws1", "First", 3);
    render(<AppHeader {...props} />);

    const btn = screen.getByRole("button", { name: "Use 3 column layout" });
    expect(btn.className).toContain("active");

    const focus = screen.getByRole("button", { name: "Use Focus column layout" });
    expect(focus.className).not.toContain("active");
  });

  it("calls setColumns when a layout button is clicked", () => {
    const props = defaultProps();
    render(<AppHeader {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Use 4 column layout" }));
    expect(props.setColumns).toHaveBeenCalledWith(4);
  });

  it("opens settings when settings button is clicked", () => {
    const props = defaultProps();
    render(<AppHeader {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Mở cài đặt" }));
    expect(props.setIsSettingsOpen).toHaveBeenCalledWith(true);
  });

  it("toggles downloads panel when downloads button is clicked", () => {
    const props = defaultProps();
    render(<AppHeader {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Tải xuống" }));
    expect(props.setIsDownloadsOpen).toHaveBeenCalledWith(expect.any(Function));
    const updater = (props.setIsDownloadsOpen as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  it("shows download dot only when hasActiveDownload is true", () => {
    const { container, rerender } = render(<AppHeader {...defaultProps()} />);
    expect(container.querySelector(".downloads-button-dot")).toBeNull();

    rerender(<AppHeader {...defaultProps({ hasActiveDownload: true })} />);
    expect(container.querySelector(".downloads-button-dot")).not.toBeNull();
  });

  it("calls addBlankPaneWithProfile and closes menu when profile is picked", () => {
    const props = defaultProps();
    const { container } = render(<AppHeader {...props} />);

    const picks = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".profile-pick:not(.profile-create)"),
    );
    const xPick = picks.find((b) => b.textContent?.includes("X"))!;
    fireEvent.click(xPick);
    expect(props.addBlankPaneWithProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: "prof-x" }),
    );
    expect(props.setIsNewPaneMenuOpen).toHaveBeenCalledWith(false);
  });

  it("calls renameProfile when edit icon is clicked", () => {
    const props = defaultProps();
    render(<AppHeader {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Đổi tên X" }));
    expect(props.renameProfile).toHaveBeenCalledWith("prof-x");
  });

  it("calls deleteProfile when trash icon is clicked", () => {
    const props = defaultProps();
    render(<AppHeader {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Xóa X" }));
    expect(props.deleteProfile).toHaveBeenCalledWith("prof-x");
  });

  it("opens text prompt when 'New profile…' is clicked and routes submit through ensureProfileWithName + addBlankPaneWithProfile", () => {
    const props = defaultProps();
    const ensure = vi.fn(() => ({ id: "prof-new", name: "New" }));
    props.ensureProfileWithName = ensure;
    render(<AppHeader {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /New profile/ }));
    expect(props.openTextPrompt).toHaveBeenCalled();
    expect(props.setIsNewPaneMenuOpen).toHaveBeenCalledWith(false);

    const opts = (props.openTextPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
    opts.onSubmit("Bob");
    expect(ensure).toHaveBeenCalledWith("Bob");
    expect(props.addBlankPaneWithProfile).toHaveBeenCalledWith({ id: "prof-new", name: "New" });
  });

  it("propagates new-pane menu open state via setIsNewPaneMenuOpen on details toggle", () => {
    const props = defaultProps({ isNewPaneMenuOpen: false });
    const { container } = render(<AppHeader {...props} />);
    const details = container.querySelector("details.new-pane-menu") as HTMLDetailsElement;
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    expect(props.setIsNewPaneMenuOpen).toHaveBeenCalledWith(true);
  });
});
