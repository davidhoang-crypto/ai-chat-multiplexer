import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMenuStates } from "./hooks/useMenuStates";

describe("useMenuStates", () => {
  it("initializes all menus closed", () => {
    const { result } = renderHook(() => useMenuStates());
    expect(result.current.isNewPaneMenuOpen).toBe(false);
    expect(result.current.isWorkspaceMenuOpen).toBe(false);
    expect(result.current.isDownloadsOpen).toBe(false);
    expect(result.current.isSettingsOpen).toBe(false);
  });

  it("toggles isNewPaneMenuOpen independently", () => {
    const { result } = renderHook(() => useMenuStates());
    act(() => result.current.setIsNewPaneMenuOpen(true));
    expect(result.current.isNewPaneMenuOpen).toBe(true);
    expect(result.current.isWorkspaceMenuOpen).toBe(false);
  });

  it("toggles isWorkspaceMenuOpen independently", () => {
    const { result } = renderHook(() => useMenuStates());
    act(() => result.current.setIsWorkspaceMenuOpen(true));
    expect(result.current.isWorkspaceMenuOpen).toBe(true);
    expect(result.current.isNewPaneMenuOpen).toBe(false);
  });

  it("allows multiple menus open simultaneously", () => {
    const { result } = renderHook(() => useMenuStates());
    act(() => {
      result.current.setIsSettingsOpen(true);
      result.current.setIsDownloadsOpen(true);
    });
    expect(result.current.isSettingsOpen).toBe(true);
    expect(result.current.isDownloadsOpen).toBe(true);
  });

  it("closes a menu after opening", () => {
    const { result } = renderHook(() => useMenuStates());
    act(() => result.current.setIsSettingsOpen(true));
    act(() => result.current.setIsSettingsOpen(false));
    expect(result.current.isSettingsOpen).toBe(false);
  });

  it("click-outside closes the new-pane menu", () => {
    const { result } = renderHook(() => useMenuStates());
    act(() => result.current.setIsNewPaneMenuOpen(true));

    const target = document.createElement("div");
    document.body.appendChild(target);
    act(() => {
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    expect(result.current.isNewPaneMenuOpen).toBe(false);
    document.body.removeChild(target);
  });

  it("ignores pointerdown events whose target is not an Element", () => {
    const { result } = renderHook(() => useMenuStates());
    act(() => result.current.setIsNewPaneMenuOpen(true));

    // Dispatching a PointerEvent directly on window has no target Element,
    // exercising the `if (!target) return;` guard.
    act(() => {
      const event = new PointerEvent("pointerdown", { bubbles: true });
      Object.defineProperty(event, "target", { value: null, configurable: true });
      window.dispatchEvent(event);
    });
    expect(result.current.isNewPaneMenuOpen).toBe(true);
  });

  it("click-outside does NOT close new-pane menu when clicking inside .new-pane-menu", () => {
    const { result } = renderHook(() => useMenuStates());
    act(() => result.current.setIsNewPaneMenuOpen(true));

    const menu = document.createElement("div");
    menu.className = "new-pane-menu";
    const inner = document.createElement("button");
    menu.appendChild(inner);
    document.body.appendChild(menu);
    act(() => {
      inner.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    expect(result.current.isNewPaneMenuOpen).toBe(true);
    document.body.removeChild(menu);
  });

  it("click-outside closes the workspace menu when click is outside .workspace-switcher", () => {
    const { result } = renderHook(() => useMenuStates());
    act(() => result.current.setIsWorkspaceMenuOpen(true));

    const target = document.createElement("div");
    document.body.appendChild(target);
    act(() => {
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    expect(result.current.isWorkspaceMenuOpen).toBe(false);
    document.body.removeChild(target);
  });

  it("click-outside closes downloads panel when click is outside .downloads-panel and .downloads-button", () => {
    const { result } = renderHook(() => useMenuStates());
    act(() => result.current.setIsDownloadsOpen(true));

    const target = document.createElement("div");
    document.body.appendChild(target);
    act(() => {
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    expect(result.current.isDownloadsOpen).toBe(false);
    document.body.removeChild(target);
  });

  it("click-outside does NOT close downloads when clicking the .downloads-button", () => {
    const { result } = renderHook(() => useMenuStates());
    act(() => result.current.setIsDownloadsOpen(true));

    const button = document.createElement("button");
    button.className = "downloads-button";
    document.body.appendChild(button);
    act(() => {
      button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    expect(result.current.isDownloadsOpen).toBe(true);
    document.body.removeChild(button);
  });

  it("does not register click-outside listener when no menu is open", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useMenuStates());
    expect(
      addSpy.mock.calls.find(([type]) => type === "pointerdown"),
    ).toBeUndefined();
    addSpy.mockRestore();
  });
});
