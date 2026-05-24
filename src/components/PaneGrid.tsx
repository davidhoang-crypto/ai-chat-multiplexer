import type { MutableRefObject } from "react";
import type { ChatPane, Profile } from "../appCore";
import { Pane } from "./Pane";

export interface PaneGridProps {
  visiblePanes: ChatPane[];
  activePanes: ChatPane[];
  effectiveColumns: number;
  focusedPaneId: string | null;
  dragOverPaneId: string | null;
  draggingTabKey: string | null;
  tabDragOver: { paneId: string; tabId: string | null; before: boolean } | null;
  editingUrls: Record<string, string>;
  paneDrag: MutableRefObject<{
    paneId: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>;
  tabDrag: MutableRefObject<{
    paneId: string;
    tabId: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>;
  webviewShells: MutableRefObject<Record<string, HTMLDivElement | null>>;
  getProfileById: (profileId: string) => Profile | undefined;
  setFocusedPaneId: (id: string | null) => void;
  setDraggingPaneId: (id: string | null) => void;
  setDragOverPaneId: (id: string | null) => void;
  setDraggingTabKey: (key: string | null) => void;
  setTabDragOver: (
    drag: { paneId: string; tabId: string | null; before: boolean } | null,
  ) => void;
  setEditingUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addTab: (paneId: string) => void;
  removeTab: (paneId: string, tabId: string) => void;
  removePane: (paneId: string) => void;
  updateActivePane: (paneId: string, updater: (pane: ChatPane) => ChatPane) => void;
  navigateActiveWebview: (
    paneId: string,
    tab: ChatPane["tabs"][number],
    action: "back" | "forward" | "reload",
  ) => void;
  startEditingUrl: (paneId: string, tab: ChatPane["tabs"][number]) => void;
  updateEditingUrl: (paneId: string, tabId: string, value: string) => void;
  commitTabUrl: (paneId: string, tabId: string) => void;
  finishPaneDrag: (clientX: number, clientY: number) => void;
  moveTabWithinPane: (
    paneId: string,
    sourceTabId: string,
    targetTabId: string,
    before: boolean,
  ) => void;
  moveTabAcrossPanes: (
    sourcePaneId: string,
    sourceTabId: string,
    targetPaneId: string,
    targetTabId: string | null,
    before: boolean,
  ) => void;
  detachTabToNewPane: (sourcePaneId: string, sourceTabId: string) => void;
}

export function PaneGrid(props: PaneGridProps) {
  const {
    visiblePanes,
    activePanes,
    effectiveColumns,
    focusedPaneId,
    dragOverPaneId,
    draggingTabKey,
    tabDragOver,
    editingUrls,
    paneDrag,
    tabDrag,
    webviewShells,
    getProfileById,
    setFocusedPaneId,
    setDraggingPaneId,
    setDragOverPaneId,
    setDraggingTabKey,
    setTabDragOver,
    setEditingUrls,
    addTab,
    removeTab,
    removePane,
    updateActivePane,
    navigateActiveWebview,
    startEditingUrl,
    updateEditingUrl,
    commitTabUrl,
    finishPaneDrag,
    moveTabWithinPane,
    moveTabAcrossPanes,
    detachTabToNewPane,
  } = props;

  return (
    <section
      className={`split-grid columns-${effectiveColumns} ${focusedPaneId ? "focus-mode" : ""}`}
    >
      {visiblePanes.map((pane, index) => (
        <Pane
          key={pane.id}
          pane={pane}
          index={index}
          paneProfile={getProfileById(pane.profileId)}
          activePanes={activePanes}
          isFocused={focusedPaneId === pane.id}
          focusedPaneId={focusedPaneId}
          dragOverPaneId={dragOverPaneId}
          draggingTabKey={draggingTabKey}
          tabDragOver={tabDragOver}
          editingUrls={editingUrls}
          paneDrag={paneDrag}
          tabDrag={tabDrag}
          registerShellRef={(paneId, element) => {
            webviewShells.current[paneId] = element;
          }}
          setFocusedPaneId={setFocusedPaneId}
          setDraggingPaneId={setDraggingPaneId}
          setDragOverPaneId={setDragOverPaneId}
          setDraggingTabKey={setDraggingTabKey}
          setTabDragOver={setTabDragOver}
          setEditingUrls={setEditingUrls}
          addTab={addTab}
          removeTab={removeTab}
          removePane={removePane}
          updateActivePane={updateActivePane}
          navigateActiveWebview={navigateActiveWebview}
          startEditingUrl={startEditingUrl}
          updateEditingUrl={updateEditingUrl}
          commitTabUrl={commitTabUrl}
          finishPaneDrag={finishPaneDrag}
          moveTabWithinPane={moveTabWithinPane}
          moveTabAcrossPanes={moveTabAcrossPanes}
          detachTabToNewPane={detachTabToNewPane}
        />
      ))}
    </section>
  );
}
