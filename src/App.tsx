import { useState } from "react";
import "./App.css";
import { AppOverlays } from "./components/AppOverlays";
import { PaneGrid } from "./components/PaneGrid";
import { AppHeader } from "./components/AppHeader";
import { useAppPersistence } from "./hooks/useAppPersistence";
import { useDragState } from "./hooks/useDragState";
import { useDerivedWorkspaceState } from "./hooks/useDerivedWorkspaceState";
import { useFocusedPaneCleanup } from "./hooks/useFocusedPaneCleanup";
import { useMenuStates } from "./hooks/useMenuStates";
import { useDownloadManager } from "./hooks/useDownloadManager";
import { useNativeWebviews } from "./hooks/useNativeWebviews";
import { useBackupAndUpdates } from "./hooks/useBackupAndUpdates";
import { useNativeTabStatus } from "./hooks/useNativeTabStatus";
import { usePaneActions } from "./hooks/usePaneActions";
import { usePromptDialogs } from "./hooks/usePromptDialogs";
import { useProfileWorkspaceActions } from "./hooks/useProfileWorkspaceActions";

function App() {
  const { state, setState, theme, setTheme } = useAppPersistence();
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const {
    isNewPaneMenuOpen,
    setIsNewPaneMenuOpen,
    isWorkspaceMenuOpen,
    setIsWorkspaceMenuOpen,
    isDownloadsOpen,
    setIsDownloadsOpen,
    isSettingsOpen,
    setIsSettingsOpen,
  } = useMenuStates();
  const {
    textPrompt,
    textPromptValue,
    setTextPromptValue,
    confirmDialog,
    setConfirmDialog,
    openTextPrompt,
    closeTextPrompt,
    submitTextPrompt,
  } = usePromptDialogs();
  const {
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
  } = useDragState();
  const downloadManager = useDownloadManager();
  const downloadToasts = downloadManager.toasts;
  const {
    updateStatus,
    backupBusy,
    checkForUpdates,
    openReleasePage,
    exportConfigJson,
    importConfigJson,
    exportFullBackup,
    restoreFullBackup,
  } = useBackupAndUpdates({
    state,
    setState,
    setFocusedPaneId,
    setConfirmDialog,
  });

  const {
    activeWorkspace,
    activePanes,
    visiblePanes,
    effectiveColumns,
    shouldSuspendNativeWebviews,
  } = useDerivedWorkspaceState({
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
  });

  useNativeWebviews({
    state,
    focusedPaneId,
    suspended: shouldSuspendNativeWebviews,
    shellsRef: webviewShells,
  });

  useFocusedPaneCleanup({ focusedPaneId, activePanes, setFocusedPaneId });

  const {
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
    finishPaneDrag,
  } = usePaneActions({
    state,
    setState,
    focusedPaneId,
    paneDrag,
    editingUrls,
    setEditingUrls,
    setDraggingPaneId,
    setDragOverPaneId,
  });

  useNativeTabStatus({ activePanes, focusedPaneId, updateActivePane });

  const {
    addBlankPaneWithProfile,
    getProfileById,
    ensureProfileWithName,
    renameProfile,
    deleteProfile,
    switchWorkspace,
    createWorkspace,
    renameActiveWorkspace,
    deleteActiveWorkspace,
  } = useProfileWorkspaceActions({
    state,
    setState,
    activeWorkspace,
    setFocusedPaneId,
    setConfirmDialog,
    openTextPrompt,
    updateActiveWorkspace,
  });


  return (
    <main className={`app-shell theme-${theme}`}>
      <AppHeader
        state={state}
        activeWorkspace={activeWorkspace}
        activePaneCount={activePanes.length}
        isWorkspaceMenuOpen={isWorkspaceMenuOpen}
        setIsWorkspaceMenuOpen={setIsWorkspaceMenuOpen}
        switchWorkspace={switchWorkspace}
        createWorkspace={createWorkspace}
        renameActiveWorkspace={renameActiveWorkspace}
        deleteActiveWorkspace={deleteActiveWorkspace}
        setColumns={setColumns}
        isNewPaneMenuOpen={isNewPaneMenuOpen}
        setIsNewPaneMenuOpen={setIsNewPaneMenuOpen}
        addBlankPaneWithProfile={addBlankPaneWithProfile}
        renameProfile={renameProfile}
        deleteProfile={deleteProfile}
        openTextPrompt={openTextPrompt}
        ensureProfileWithName={ensureProfileWithName}
        hasActiveDownload={downloadManager.hasActiveDownload}
        setIsDownloadsOpen={setIsDownloadsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
      />

      <PaneGrid
        visiblePanes={visiblePanes}
        activePanes={activePanes}
        effectiveColumns={effectiveColumns}
        focusedPaneId={focusedPaneId}
        dragOverPaneId={dragOverPaneId}
        draggingTabKey={draggingTabKey}
        tabDragOver={tabDragOver}
        editingUrls={editingUrls}
        paneDrag={paneDrag}
        tabDrag={tabDrag}
        webviewShells={webviewShells}
        getProfileById={getProfileById}
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
      <AppOverlays
        textPrompt={textPrompt}
        textPromptValue={textPromptValue}
        setTextPromptValue={setTextPromptValue}
        closeTextPrompt={closeTextPrompt}
        submitTextPrompt={submitTextPrompt}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        theme={theme}
        setTheme={setTheme}
        updateStatus={updateStatus}
        checkForUpdates={checkForUpdates}
        openReleasePage={openReleasePage}
        backupBusy={backupBusy}
        exportConfigJson={exportConfigJson}
        importConfigJson={importConfigJson}
        exportFullBackup={exportFullBackup}
        restoreFullBackup={restoreFullBackup}
        isDownloadsOpen={isDownloadsOpen}
        setIsDownloadsOpen={setIsDownloadsOpen}
        downloadToasts={downloadToasts}
        dismissToast={downloadManager.dismissToast}
        openFile={downloadManager.openFile}
        revealFolder={downloadManager.revealFolder}
        clearAll={downloadManager.clearAll}
      />
    </main>
  );
}

export default App;
