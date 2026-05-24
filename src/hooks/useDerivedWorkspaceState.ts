import type { AppState, ChatPane, Workspace } from "../appCore";

export interface UseDerivedWorkspaceStateArgs {
  state: AppState;
  focusedPaneId: string | null;
  isNewPaneMenuOpen: boolean;
  isWorkspaceMenuOpen: boolean;
  isSettingsOpen: boolean;
  isDownloadsOpen: boolean;
  draggingPaneId: string | null;
  draggingTabKey: string | null;
  textPrompt: unknown | null;
  confirmDialog: unknown | null;
}

export interface UseDerivedWorkspaceStateResult {
  activeWorkspace: Workspace;
  activePanes: ChatPane[];
  visiblePanes: ChatPane[];
  effectiveColumns: number;
  shouldSuspendNativeWebviews: boolean;
}

/**
 * Derives workspace-related view-model values from the source state plus UI flags.
 *
 * Returns:
 * - activeWorkspace: current workspace (or first as fallback)
 * - activePanes: panes in active workspace
 * - visiblePanes: filtered to focused pane when focus mode is active
 * - effectiveColumns: clamped column count (1 in focus mode)
 * - shouldSuspendNativeWebviews: any modal/menu/drag is suspending native overlays
 */
export function useDerivedWorkspaceState(
  args: UseDerivedWorkspaceStateArgs,
): UseDerivedWorkspaceStateResult {
  const {
    state,
    focusedPaneId,
    isNewPaneMenuOpen,
    isWorkspaceMenuOpen,
    isSettingsOpen,
    isDownloadsOpen,
    draggingPaneId,
    draggingTabKey,
    textPrompt,
    confirmDialog,
  } = args;

  const activeWorkspace =
    state.workspaces.find((ws) => ws.id === state.activeWorkspaceId) ?? state.workspaces[0];
  const activePanes = activeWorkspace.panes;
  const visiblePanes = focusedPaneId
    ? activePanes.filter((pane) => pane.id === focusedPaneId)
    : activePanes;
  const effectiveColumns = focusedPaneId
    ? 1
    : Math.max(1, Math.min(activeWorkspace.columns, activePanes.length));
  const shouldSuspendNativeWebviews =
    isNewPaneMenuOpen ||
    isWorkspaceMenuOpen ||
    draggingPaneId !== null ||
    textPrompt !== null ||
    confirmDialog !== null ||
    isSettingsOpen ||
    isDownloadsOpen ||
    draggingTabKey !== null;

  return {
    activeWorkspace,
    activePanes,
    visiblePanes,
    effectiveColumns,
    shouldSuspendNativeWebviews,
  };
}
