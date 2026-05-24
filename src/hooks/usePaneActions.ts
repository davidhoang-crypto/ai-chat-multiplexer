import { invoke } from "@tauri-apps/api/core";
import {
  createId,
  getDisplayUrl,
  getFallbackTabTitle,
  getNativeWebviewLabel,
  getOriginFallbackIcon,
  getTabKey,
  isTauriRuntime,
  resolveAddress,
  type AppState,
  type ChatPane,
  type ChatTab,
  type Workspace,
} from "../appCore";
import { getNewTabUrl, NEW_TAB_TITLE } from "../newtab";

export interface UsePaneActionsArgs {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  focusedPaneId: string | null;
  paneDrag: React.MutableRefObject<{
    paneId: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>;
  editingUrls: Record<string, string>;
  setEditingUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setDraggingPaneId: (id: string | null) => void;
  setDragOverPaneId: (id: string | null) => void;
}

export interface PaneActions {
  updateActiveWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
  updateActivePane: (paneId: string, updater: (pane: ChatPane) => ChatPane) => void;
  setColumns: (columns: number) => void;
  removePane: (paneId: string) => void;
  addTab: (paneId: string) => void;
  removeTab: (paneId: string, tabId: string) => void;
  startEditingUrl: (paneId: string, tab: ChatTab) => void;
  updateEditingUrl: (paneId: string, tabId: string, value: string) => void;
  commitTabUrl: (paneId: string, tabId: string) => void;
  navigateActiveWebview: (
    paneId: string,
    tab: ChatTab,
    action: "back" | "forward" | "reload",
  ) => void;
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
  movePane: (sourcePaneId: string, targetPaneId: string) => void;
  finishPaneDrag: (clientX: number, clientY: number) => void;
}

export function usePaneActions({
  state,
  setState,
  focusedPaneId,
  paneDrag,
  editingUrls,
  setEditingUrls,
  setDraggingPaneId,
  setDragOverPaneId,
}: UsePaneActionsArgs): PaneActions {
  function updateActiveWorkspace(updater: (workspace: Workspace) => Workspace) {
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? updater(workspace) : workspace,
      ),
    }));
  }

  function updateActivePane(paneId: string, updater: (pane: ChatPane) => ChatPane) {
    updateActiveWorkspace((workspace) => ({
      ...workspace,
      panes: workspace.panes.map((pane) => (pane.id === paneId ? updater(pane) : pane)),
    }));
  }

  function setColumns(columns: number) {
    updateActiveWorkspace((workspace) => ({ ...workspace, columns }));
  }

  function removePane(paneId: string) {
    updateActiveWorkspace((workspace) => ({
      ...workspace,
      panes:
        workspace.panes.length > 1
          ? workspace.panes.filter((pane) => pane.id !== paneId)
          : workspace.panes,
    }));
  }

  function addTab(paneId: string) {
    updateActivePane(paneId, (pane) => {
      const tabId = createId("tab");
      const newTabUrl = getNewTabUrl();
      const nextTab: ChatTab = {
        id: tabId,
        title: NEW_TAB_TITLE,
        url: newTabUrl,
        loadedUrl: newTabUrl,
        currentUrl: newTabUrl,
      };

      return {
        ...pane,
        activeTabId: tabId,
        tabs: [...pane.tabs, nextTab],
      };
    });
  }

  function removeTab(paneId: string, tabId: string) {
    updateActivePane(paneId, (pane) => {
      // If this is the last tab, replace it with a fresh new-tab page instead
      // of leaving an empty pane.
      if (pane.tabs.length === 1) {
        if (pane.tabs[0].id !== tabId) return pane;
        const newTabId = createId("tab");
        const newTabUrl = getNewTabUrl();
        return {
          ...pane,
          activeTabId: newTabId,
          tabs: [
            {
              id: newTabId,
              title: NEW_TAB_TITLE,
              url: newTabUrl,
              loadedUrl: newTabUrl,
              currentUrl: newTabUrl,
            },
          ],
        };
      }

      const nextTabs = pane.tabs.filter((tab) => tab.id !== tabId);

      return {
        ...pane,
        tabs: nextTabs,
        activeTabId: pane.activeTabId === tabId ? nextTabs[0].id : pane.activeTabId,
      };
    });
  }

  function startEditingUrl(paneId: string, tab: ChatTab) {
    setEditingUrls((current) => ({
      ...current,
      [getTabKey(paneId, tab.id)]: getDisplayUrl(tab),
    }));
  }

  function updateEditingUrl(paneId: string, tabId: string, value: string) {
    setEditingUrls((current) => ({
      ...current,
      [getTabKey(paneId, tabId)]: value,
    }));
  }

  function commitTabUrl(paneId: string, tabId: string) {
    const tabKey = getTabKey(paneId, tabId);
    const draftUrl = editingUrls[tabKey];

    setEditingUrls((current) => {
      const next = { ...current };
      delete next[tabKey];
      return next;
    });

    if (draftUrl === undefined) {
      return;
    }

    const trimmed = draftUrl.trim();
    if (!trimmed) {
      // Empty input → reset tab to new tab page.
      const newTabUrl = getNewTabUrl();
      updateActivePane(paneId, (pane) => ({
        ...pane,
        tabs: pane.tabs.map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                title: NEW_TAB_TITLE,
                url: newTabUrl,
                loadedUrl: newTabUrl,
                currentUrl: newTabUrl,
                faviconUrl: undefined,
                isLoading: false,
              }
            : tab,
        ),
      }));
      return;
    }

    updateActivePane(paneId, (pane) => ({
      ...pane,
      tabs: pane.tabs.map((tab) => {
        if (tab.id !== tabId) {
          return tab;
        }

        const loadedUrl = resolveAddress(draftUrl);

        return {
          ...tab,
          title: getFallbackTabTitle(loadedUrl),
          url: loadedUrl,
          loadedUrl,
          currentUrl: loadedUrl,
          faviconUrl: getOriginFallbackIcon(loadedUrl),
          isLoading: true,
        };
      }),
    }));
  }

  function navigateActiveWebview(
    paneId: string,
    tab: ChatTab,
    action: "back" | "forward" | "reload",
  ) {
    if (!isTauriRuntime()) {
      if (action === "back") {
        window.history.back();
      } else if (action === "forward") {
        window.history.forward();
      } else {
        window.location.reload();
      }
      return;
    }

    void invoke("native_webview_navigate", {
      label: getNativeWebviewLabel(paneId, tab),
      action,
    }).catch((error) => console.error("native_webview_navigate failed", error));
  }

  function moveTabWithinPane(
    paneId: string,
    sourceTabId: string,
    targetTabId: string,
    before: boolean,
  ) {
    if (sourceTabId === targetTabId) return;
    updateActivePane(paneId, (pane) => {
      const sourceIndex = pane.tabs.findIndex((tab) => tab.id === sourceTabId);
      if (sourceIndex < 0) return pane;

      const tabs = [...pane.tabs];
      const [moved] = tabs.splice(sourceIndex, 1);
      const adjustedTarget = tabs.findIndex((tab) => tab.id === targetTabId);
      if (adjustedTarget < 0) {
        // target removed during splice (shouldn't happen) — append.
        tabs.push(moved);
      } else {
        const insertAt = before ? adjustedTarget : adjustedTarget + 1;
        tabs.splice(insertAt, 0, moved);
      }
      return { ...pane, tabs };
    });
  }

  function moveTabAcrossPanes(
    sourcePaneId: string,
    sourceTabId: string,
    targetPaneId: string,
    targetTabId: string | null,
    before: boolean,
  ) {
    if (sourcePaneId === targetPaneId) return;
    updateActiveWorkspace((workspace) => {
      const sourcePane = workspace.panes.find((pane) => pane.id === sourcePaneId);
      const targetPane = workspace.panes.find((pane) => pane.id === targetPaneId);
      if (!sourcePane || !targetPane) return workspace;

      // Only allow if both panes share the same profile.
      if (sourcePane.profileId !== targetPane.profileId) return workspace;

      const tab = sourcePane.tabs.find((t) => t.id === sourceTabId);
      if (!tab) return workspace;

      // Don't leave the source pane empty.
      if (sourcePane.tabs.length <= 1) return workspace;

      const updatedSourceTabs = sourcePane.tabs.filter((t) => t.id !== sourceTabId);
      const updatedSource: ChatPane = {
        ...sourcePane,
        tabs: updatedSourceTabs,
        activeTabId:
          sourcePane.activeTabId === sourceTabId
            ? updatedSourceTabs[0].id
            : sourcePane.activeTabId,
      };

      const targetTabs = [...targetPane.tabs];
      let insertAt = targetTabs.length;
      if (targetTabId) {
        const targetIndex = targetTabs.findIndex((t) => t.id === targetTabId);
        if (targetIndex >= 0) {
          insertAt = before ? targetIndex : targetIndex + 1;
        }
      }
      targetTabs.splice(insertAt, 0, tab);

      const updatedTarget: ChatPane = {
        ...targetPane,
        tabs: targetTabs,
        activeTabId: tab.id,
      };

      return {
        ...workspace,
        panes: workspace.panes.map((pane) => {
          if (pane.id === sourcePaneId) return updatedSource;
          if (pane.id === targetPaneId) return updatedTarget;
          return pane;
        }),
      };
    });
  }

  function detachTabToNewPane(sourcePaneId: string, sourceTabId: string) {
    updateActiveWorkspace((workspace) => {
      const sourcePane = workspace.panes.find((pane) => pane.id === sourcePaneId);
      if (!sourcePane) return workspace;
      const tab = sourcePane.tabs.find((t) => t.id === sourceTabId);
      if (!tab) return workspace;

      // If this is the only tab in the pane, do nothing — moving it would leave
      // an empty pane. (Handled separately by caller if needed.)
      if (sourcePane.tabs.length <= 1) return workspace;

      const remainingTabs = sourcePane.tabs.filter((t) => t.id !== sourceTabId);
      const updatedSource: ChatPane = {
        ...sourcePane,
        tabs: remainingTabs,
        activeTabId:
          sourcePane.activeTabId === sourceTabId
            ? remainingTabs[0].id
            : sourcePane.activeTabId,
      };

      const newPane: ChatPane = {
        id: createId("pane"),
        title: sourcePane.title,
        profileId: sourcePane.profileId,
        activeTabId: tab.id,
        tabs: [tab],
      };

      return {
        ...workspace,
        panes: workspace.panes
          .map((pane) => (pane.id === sourcePaneId ? updatedSource : pane))
          .concat(newPane),
      };
    });
  }

  function movePane(sourcePaneId: string, targetPaneId: string) {
    if (sourcePaneId === targetPaneId || focusedPaneId) {
      return;
    }

    updateActiveWorkspace((workspace) => {
      const sourceIndex = workspace.panes.findIndex((pane) => pane.id === sourcePaneId);
      const targetIndex = workspace.panes.findIndex((pane) => pane.id === targetPaneId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return workspace;
      }

      const panes = [...workspace.panes];
      const [sourcePane] = panes.splice(sourceIndex, 1);
      panes.splice(targetIndex, 0, sourcePane);

      return { ...workspace, panes };
    });
  }

  function finishPaneDrag(clientX: number, clientY: number) {
    const activeDrag = paneDrag.current;
    paneDrag.current = null;

    if (activeDrag?.active) {
      const target = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>("[data-pane-id]");
      const targetPaneId = target?.dataset.paneId;

      if (targetPaneId) {
        movePane(activeDrag.paneId, targetPaneId);
      }
    }

    setDraggingPaneId(null);
    setDragOverPaneId(null);
  }

  // Suppress unused warning for `state` if TS strict — keep arg for future use
  void state;

  return {
    updateActiveWorkspace,
    updateActivePane,
    setColumns,
    removePane,
    addTab,
    removeTab,
    startEditingUrl,
    updateEditingUrl,
    commitTabUrl,
    navigateActiveWebview,
    moveTabWithinPane,
    moveTabAcrossPanes,
    detachTabToNewPane,
    movePane,
    finishPaneDrag,
  };
}
