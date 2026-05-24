import { describe, expect, it } from "vitest";
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
});
