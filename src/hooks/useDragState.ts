import { useRef, useState } from "react";

export interface PaneDragRef {
  paneId: string;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
}

export interface TabDragRef {
  paneId: string;
  tabId: string;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
}

export interface TabDragOver {
  paneId: string;
  tabId: string | null;
  before: boolean;
}

/**
 * Owns all drag-related state + refs shared by PaneGrid and App.
 *
 * - paneDrag/tabDrag refs for pointer-down tracking
 * - webviewShells ref for native overlay registration
 * - editingUrls map for inline URL editor
 * - draggingPaneId/dragOverPaneId for pane reorder
 * - draggingTabKey/tabDragOver for tab reorder/detach
 */
export function useDragState() {
  const [draggingPaneId, setDraggingPaneId] = useState<string | null>(null);
  const [dragOverPaneId, setDragOverPaneId] = useState<string | null>(null);
  const [editingUrls, setEditingUrls] = useState<Record<string, string>>({});
  const [tabDragOver, setTabDragOver] = useState<TabDragOver | null>(null);
  const [draggingTabKey, setDraggingTabKey] = useState<string | null>(null);

  const webviewShells = useRef<Record<string, HTMLDivElement | null>>({});
  const paneDrag = useRef<PaneDragRef | null>(null);
  const tabDrag = useRef<TabDragRef | null>(null);

  return {
    draggingPaneId,
    setDraggingPaneId,
    dragOverPaneId,
    setDragOverPaneId,
    editingUrls,
    setEditingUrls,
    tabDragOver,
    setTabDragOver,
    draggingTabKey,
    setDraggingTabKey,
    webviewShells,
    paneDrag,
    tabDrag,
  };
}
