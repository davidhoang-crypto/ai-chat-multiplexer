import type { ConfirmDialogOptions } from "../types/dialogs";
import type { DownloadToast, ThemeMode } from "../appCore";
import type { UpdateStatus, BackupBusy } from "./SettingsModal";
import { ConfirmDialog, TextPromptModal } from "./Modals";
import { SettingsModal } from "./SettingsModal";
import { DownloadToastStack } from "./DownloadToastStack";
import { DownloadsPanel } from "./DownloadsPanel";

type TextPromptState = {
  title: string;
  initial: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
};

export interface AppOverlaysProps {
  textPrompt: TextPromptState | null;
  textPromptValue: string;
  setTextPromptValue: (value: string) => void;
  closeTextPrompt: () => void;
  submitTextPrompt: () => void;

  confirmDialog: ConfirmDialogOptions | null;
  setConfirmDialog: (dialog: ConfirmDialogOptions | null) => void;

  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  updateStatus: UpdateStatus;
  checkForUpdates: () => void;
  openReleasePage: (url: string) => void;
  backupBusy: BackupBusy;
  exportConfigJson: () => void;
  importConfigJson: () => void;
  exportFullBackup: () => void;
  restoreFullBackup: () => void;

  isDownloadsOpen: boolean;
  setIsDownloadsOpen: (open: boolean) => void;
  downloadToasts: DownloadToast[];
  dismissToast: (id: string) => void;
  openFile: (path: string) => Promise<void> | void;
  revealFolder: (path: string) => void;
  clearAll: () => void;
}

export function AppOverlays(props: AppOverlaysProps) {
  const {
    textPrompt,
    textPromptValue,
    setTextPromptValue,
    closeTextPrompt,
    submitTextPrompt,
    confirmDialog,
    setConfirmDialog,
    isSettingsOpen,
    setIsSettingsOpen,
    theme,
    setTheme,
    updateStatus,
    checkForUpdates,
    openReleasePage,
    backupBusy,
    exportConfigJson,
    importConfigJson,
    exportFullBackup,
    restoreFullBackup,
    isDownloadsOpen,
    setIsDownloadsOpen,
    downloadToasts,
    dismissToast,
    openFile,
    revealFolder,
    clearAll,
  } = props;

  return (
    <>
      <TextPromptModal
        prompt={textPrompt}
        value={textPromptValue}
        onValueChange={setTextPromptValue}
        onClose={closeTextPrompt}
        onSubmit={submitTextPrompt}
      />

      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        updateStatus={updateStatus}
        onCheckForUpdates={checkForUpdates}
        onOpenReleasePage={openReleasePage}
        backupBusy={backupBusy}
        onExportConfig={exportConfigJson}
        onImportConfig={importConfigJson}
        onExportFullBackup={exportFullBackup}
        onRestoreFullBackup={restoreFullBackup}
      />

      <DownloadToastStack
        toasts={downloadToasts}
        onDismiss={dismissToast}
        onOpenFile={(path) => void openFile(path)}
        onRevealFolder={revealFolder}
      />

      <DownloadsPanel
        open={isDownloadsOpen}
        items={downloadToasts}
        onClose={() => setIsDownloadsOpen(false)}
        onClearAll={clearAll}
        onOpenFile={(path) => void openFile(path)}
        onRevealFolder={revealFolder}
      />
    </>
  );
}
