import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDragState } from "./hooks/useDragState";

describe("useDragState", () => {
  it("initializes all state values to defaults", () => {
    const { result } = renderHook(() => useDragState());
    expect(result.current.draggingPaneId).toBeNull();
    expect(result.current.dragOverPaneId).toBeNull();
    expect(result.current.editingUrls).toEqual({});
    expect(result.current.tabDragOver).toBeNull();
    expect(result.current.draggingTabKey).toBeNull();
  });

  it("provides ref objects with current=null/{}", () => {
    const { result } = renderHook(() => useDragState());
    expect(result.current.paneDrag.current).toBeNull();
    expect(result.current.tabDrag.current).toBeNull();
    expect(result.current.webviewShells.current).toEqual({});
  });

  it("updates draggingPaneId via setter", () => {
    const { result } = renderHook(() => useDragState());
    act(() => result.current.setDraggingPaneId("p1"));
    expect(result.current.draggingPaneId).toBe("p1");
  });

  it("updates editingUrls map", () => {
    const { result } = renderHook(() => useDragState());
    act(() => result.current.setEditingUrls({ p1: "https://a.com", p2: "https://b.com" }));
    expect(result.current.editingUrls).toEqual({
      p1: "https://a.com",
      p2: "https://b.com",
    });
  });

  it("updates tabDragOver with structure", () => {
    const { result } = renderHook(() => useDragState());
    act(() => result.current.setTabDragOver({ paneId: "p1", tabId: "t1", before: true }));
    expect(result.current.tabDragOver).toEqual({ paneId: "p1", tabId: "t1", before: true });
  });

  it("preserves ref identity across renders", () => {
    const { result, rerender } = renderHook(() => useDragState());
    const initialPaneDrag = result.current.paneDrag;
    const initialTabDrag = result.current.tabDrag;
    const initialShells = result.current.webviewShells;
    rerender();
    expect(result.current.paneDrag).toBe(initialPaneDrag);
    expect(result.current.tabDrag).toBe(initialTabDrag);
    expect(result.current.webviewShells).toBe(initialShells);
  });

  it("ref mutations persist without rerender", () => {
    const { result } = renderHook(() => useDragState());
    result.current.paneDrag.current = {
      paneId: "p1",
      pointerId: 1,
      startX: 10,
      startY: 20,
      active: true,
    };
    expect(result.current.paneDrag.current).toEqual({
      paneId: "p1",
      pointerId: 1,
      startX: 10,
      startY: 20,
      active: true,
    });
  });
});
