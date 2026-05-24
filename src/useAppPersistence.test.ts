import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAppPersistence } from "./hooks/useAppPersistence";
import { STORAGE_KEY, THEME_STORAGE_KEY } from "./appCore";

describe("useAppPersistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns default state when localStorage is empty", () => {
    const { result } = renderHook(() => useAppPersistence());
    expect(result.current.state.workspaces.length).toBeGreaterThan(0);
    expect(result.current.state.activeWorkspaceId).toBe(result.current.state.workspaces[0].id);
  });

  it("defaults theme to light when no saved theme", () => {
    const { result } = renderHook(() => useAppPersistence());
    expect(result.current.theme).toBe("light");
  });

  it("loads saved dark theme from localStorage", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const { result } = renderHook(() => useAppPersistence());
    expect(result.current.theme).toBe("dark");
  });

  it("treats invalid theme value as light", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "neon");
    const { result } = renderHook(() => useAppPersistence());
    expect(result.current.theme).toBe("light");
  });

  it("persists state to localStorage when state changes", () => {
    const { result } = renderHook(() => useAppPersistence());
    const initial = result.current.state;
    act(() => {
      result.current.setState({
        ...initial,
        workspaces: initial.workspaces.map((ws) =>
          ws.id === initial.activeWorkspaceId ? { ...ws, name: "Renamed" } : ws,
        ),
      });
    });
    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    const updated = parsed.workspaces.find(
      (ws: { id: string }) => ws.id === initial.activeWorkspaceId,
    );
    expect(updated.name).toBe("Renamed");
  });

  it("persists theme to localStorage when theme changes", () => {
    const { result } = renderHook(() => useAppPersistence());
    act(() => {
      result.current.setTheme("dark");
    });
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("writes initial state to localStorage on mount", () => {
    renderHook(() => useAppPersistence());
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("writes initial theme to localStorage on mount", () => {
    renderHook(() => useAppPersistence());
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
