import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFocusedPaneCleanup } from "./hooks/useFocusedPaneCleanup";
import type { ChatPane } from "./appCore";

function makePane(id: string): ChatPane {
  return {
    id,
    title: `Pane ${id}`,
    profileId: "prof-default",
    activeTabId: `${id}-t1`,
    tabs: [{ id: `${id}-t1`, title: "Tab", url: "https://example.com", loadedUrl: "https://example.com" }],
  };
}

describe("useFocusedPaneCleanup", () => {
  it("does not clear focusedPaneId when focused pane exists", () => {
    const setFocusedPaneId = vi.fn();
    const panes = [makePane("p1"), makePane("p2")];
    renderHook(() =>
      useFocusedPaneCleanup({
        focusedPaneId: "p1",
        activePanes: panes,
        setFocusedPaneId,
      }),
    );
    expect(setFocusedPaneId).not.toHaveBeenCalled();
  });

  it("clears focusedPaneId when focused pane no longer exists", () => {
    const setFocusedPaneId = vi.fn();
    const panes = [makePane("p2")];
    renderHook(() =>
      useFocusedPaneCleanup({
        focusedPaneId: "p1",
        activePanes: panes,
        setFocusedPaneId,
      }),
    );
    expect(setFocusedPaneId).toHaveBeenCalledWith(null);
  });

  it("does nothing when focusedPaneId is null", () => {
    const setFocusedPaneId = vi.fn();
    renderHook(() =>
      useFocusedPaneCleanup({
        focusedPaneId: null,
        activePanes: [makePane("p1")],
        setFocusedPaneId,
      }),
    );
    expect(setFocusedPaneId).not.toHaveBeenCalled();
  });

  it("clears focusedPaneId after a rerender removes the focused pane", () => {
    const setFocusedPaneId = vi.fn();
    const initial = [makePane("p1"), makePane("p2")];
    const { rerender } = renderHook(
      ({ panes }: { panes: ChatPane[] }) =>
        useFocusedPaneCleanup({
          focusedPaneId: "p1",
          activePanes: panes,
          setFocusedPaneId,
        }),
      { initialProps: { panes: initial } },
    );
    expect(setFocusedPaneId).not.toHaveBeenCalled();

    rerender({ panes: [makePane("p2")] });
    expect(setFocusedPaneId).toHaveBeenCalledWith(null);
  });
});
