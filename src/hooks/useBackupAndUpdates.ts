import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import {
  APP_VERSION,
  DEFAULT_PROFILE_ID,
  GITHUB_REPO,
  RELEASES_URL,
  compareVersions,
  createDefaultProfiles,
  hydrateTabs,
  isTauriRuntime,
  type AppState,
} from "../appCore";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; latest: string; releaseUrl: string }
  | { kind: "current" }
  | { kind: "error"; message: string };

export type BackupBusy = "idle" | "exporting" | "importing";

export interface ConfirmDialogRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export interface UseBackupAndUpdatesArgs {
  state: AppState;
  setState: (next: AppState) => void;
  setFocusedPaneId: (id: string | null) => void;
  setConfirmDialog: (dialog: ConfirmDialogRequest | null) => void;
}

export interface UseBackupAndUpdatesResult {
  updateStatus: UpdateStatus;
  backupBusy: BackupBusy;
  checkForUpdates: () => Promise<void>;
  openReleasePage: (url: string) => Promise<void>;
  exportConfigJson: () => Promise<void>;
  importConfigJson: () => Promise<void>;
  exportFullBackup: () => Promise<void>;
  restoreFullBackup: () => Promise<void>;
}

export function useBackupAndUpdates({
  state,
  setState,
  setFocusedPaneId,
  setConfirmDialog,
}: UseBackupAndUpdatesArgs): UseBackupAndUpdatesResult {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: "idle" });
  const [backupBusy, setBackupBusy] = useState<BackupBusy>("idle");

  async function checkForUpdates() {
    setUpdateStatus({ kind: "checking" });
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as { tag_name?: string; html_url?: string };
      const latestTag = data.tag_name?.replace(/^v/, "") ?? "";
      const releaseUrl = data.html_url ?? RELEASES_URL;

      if (!latestTag) {
        setUpdateStatus({ kind: "error", message: "Không đọc được phiên bản mới." });
        return;
      }

      if (compareVersions(latestTag, APP_VERSION) > 0) {
        setUpdateStatus({ kind: "available", latest: latestTag, releaseUrl });
      } else {
        setUpdateStatus({ kind: "current" });
      }
    } catch (error) {
      setUpdateStatus({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function openReleasePage(url: string) {
    if (isTauriRuntime()) {
      try {
        await invoke("plugin:opener|open_url", { url });
        return;
      } catch {
        // fallthrough to window.open
      }
    }
    window.open(url, "_blank", "noopener");
  }

  async function exportConfigJson() {
    setBackupBusy("exporting");
    try {
      const json = JSON.stringify(state, null, 2);

      if (isTauriRuntime()) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const filePath = await save({
          title: "Lưu cấu hình",
          defaultPath: `ai-multiplexer-config-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!filePath) {
          setBackupBusy("idle");
          return;
        }
        await invoke("plugin:fs|write_text_file", { path: filePath, contents: json }).catch(
          async () => {
            // tauri-plugin-fs may not be available, fall back to raw command
            const { writeTextFile } = await import("@tauri-apps/plugin-fs").catch(() => ({
              writeTextFile: null as null | ((p: string, c: string) => Promise<void>),
            }));
            if (writeTextFile) {
              await writeTextFile(filePath, json);
              return;
            }
            throw new Error("File system plugin không khả dụng");
          },
        );
      } else {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ai-multiplexer-config-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      window.alert(`Export lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBackupBusy("idle");
    }
  }

  async function importConfigJson() {
    setBackupBusy("importing");
    try {
      let text: string | null = null;

      if (isTauriRuntime()) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const filePath = await open({
          title: "Chọn file cấu hình",
          multiple: false,
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!filePath || typeof filePath !== "string") {
          setBackupBusy("idle");
          return;
        }
        const { readTextFile } = await import("@tauri-apps/plugin-fs").catch(() => ({
          readTextFile: null as null | ((p: string) => Promise<string>),
        }));
        if (!readTextFile) throw new Error("File system plugin không khả dụng");
        text = await readTextFile(filePath);
      } else {
        text = await new Promise<string | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "application/json";
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            resolve(await file.text());
          };
          input.click();
        });
      }

      if (!text) {
        setBackupBusy("idle");
        return;
      }

      const parsed = JSON.parse(text) as AppState;
      if (!Array.isArray(parsed.workspaces) || parsed.workspaces.length === 0) {
        throw new Error("File không phải config hợp lệ");
      }

      setConfirmDialog({
        title: "Thay thế cấu hình hiện tại?",
        message: "Tất cả workspace và profile hiện tại sẽ bị thay bằng nội dung từ file.",
        confirmLabel: "Thay thế",
        danger: true,
        onConfirm: () => {
          const profiles =
            Array.isArray(parsed.profiles) && parsed.profiles.length > 0
              ? parsed.profiles
              : createDefaultProfiles();
          const profileIds = new Set(profiles.map((p) => p.id));
          const workspaces = parsed.workspaces.map((ws) => ({
            ...ws,
            panes: ws.panes.map((pane) => ({
              ...pane,
              profileId: profileIds.has(pane.profileId) ? pane.profileId : DEFAULT_PROFILE_ID,
              tabs: hydrateTabs(pane.tabs ?? []),
            })),
          }));
          const activeId = workspaces.some((ws) => ws.id === parsed.activeWorkspaceId)
            ? parsed.activeWorkspaceId
            : workspaces[0].id;
          setState({ workspaces, activeWorkspaceId: activeId, profiles });
          setFocusedPaneId(null);
        },
      });
    } catch (error) {
      window.alert(`Import lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBackupBusy("idle");
    }
  }

  async function exportFullBackup() {
    if (!isTauriRuntime()) {
      window.alert("Backup full (kèm session/cookie) chỉ chạy được trong app desktop.");
      return;
    }
    setBackupBusy("exporting");
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const filePath = await save({
        title: "Lưu full backup",
        defaultPath: `ai-multiplexer-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!filePath) {
        setBackupBusy("idle");
        return;
      }
      // Save config alongside zip as <name>.json
      const configPath = filePath.replace(/\.zip$/i, ".json");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs").catch(() => ({
        writeTextFile: null as null | ((p: string, c: string) => Promise<void>),
      }));
      if (writeTextFile) {
        await writeTextFile(configPath, JSON.stringify(state, null, 2));
      }
      await invoke("backup_sessions_zip", { outputPath: filePath });
      window.alert(
        `Backup hoàn tất:\n• ${filePath}\n• ${configPath}\n\nĐể restore, dùng cả 2 file.`,
      );
    } catch (error) {
      window.alert(`Backup lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBackupBusy("idle");
    }
  }

  async function restoreFullBackup() {
    if (!isTauriRuntime()) {
      window.alert("Restore full chỉ chạy được trong app desktop.");
      return;
    }
    setBackupBusy("importing");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const filePath = await open({
        title: "Chọn file backup .zip (sessions)",
        multiple: false,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!filePath || typeof filePath !== "string") {
        setBackupBusy("idle");
        return;
      }

      setConfirmDialog({
        title: "Restore session?",
        message: "Cookies hiện tại sẽ bị thay thế. App sẽ cần restart để áp dụng đầy đủ.",
        confirmLabel: "Restore",
        danger: true,
        onConfirm: async () => {
          try {
            await invoke("restore_sessions_zip", { inputPath: filePath });
            window.alert("Đã restore. Hãy đóng và mở lại app để áp dụng đầy đủ.");
          } catch (error) {
            window.alert(`Restore lỗi: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
      });
    } catch (error) {
      window.alert(`Restore lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBackupBusy("idle");
    }
  }

  return {
    updateStatus,
    backupBusy,
    checkForUpdates,
    openReleasePage,
    exportConfigJson,
    importConfigJson,
    exportFullBackup,
    restoreFullBackup,
  };
}
