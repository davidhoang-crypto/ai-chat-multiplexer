import {
  IconCheck,
  IconDownload,
  IconExternal,
  IconMoon,
  IconRefresh,
  IconSettings as _IconSettings,
  IconSun,
  IconUpload,
  IconX,
} from "../Icons";
import { APP_VERSION, GITHUB_REPO, isTauriRuntime, type ThemeMode } from "../appCore";

void _IconSettings; // re-exported indirectly so the file remains stable on tree-shake

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; latest: string; releaseUrl: string }
  | { kind: "current" }
  | { kind: "error"; message: string };

export type BackupBusy = "idle" | "exporting" | "importing";

export type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  updateStatus: UpdateStatus;
  onCheckForUpdates: () => void;
  onOpenReleasePage: (url: string) => void;
  backupBusy: BackupBusy;
  onExportConfig: () => void;
  onImportConfig: () => void;
  onExportFullBackup: () => void;
  onRestoreFullBackup: () => void;
};

export function SettingsModal({
  open,
  onClose,
  theme,
  onThemeChange,
  updateStatus,
  onCheckForUpdates,
  onOpenReleasePage,
  backupBusy,
  onExportConfig,
  onImportConfig,
  onExportFullBackup,
  onRestoreFullBackup,
}: SettingsModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-card settings-card">
        <header className="settings-header">
          <h3 className="modal-title">Settings</h3>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            <IconX size={14} />
          </button>
        </header>

        <section className="settings-section">
          <h4 className="settings-section-title">Giao diện</h4>
          <div className="settings-row">
            <span className="settings-label">Chế độ</span>
            <div className="layout-segment settings-theme-segment">
              <button
                type="button"
                className={theme === "light" ? "segment active" : "segment"}
                onClick={() => onThemeChange("light")}
              >
                <IconSun size={12} /> Sáng
              </button>
              <button
                type="button"
                className={theme === "dark" ? "segment active" : "segment"}
                onClick={() => onThemeChange("dark")}
              >
                <IconMoon size={12} /> Tối
              </button>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h4 className="settings-section-title">Cập nhật</h4>
          <div className="settings-row">
            <span className="settings-label">Phiên bản hiện tại</span>
            <span className="settings-meta">v{APP_VERSION}</span>
          </div>
          <div className="settings-row settings-update-row">
            {updateStatus.kind === "idle" && (
              <button type="button" className="modal-btn" onClick={onCheckForUpdates}>
                <IconRefresh size={12} /> Kiểm tra cập nhật
              </button>
            )}
            {updateStatus.kind === "checking" && (
              <span className="settings-meta">Đang kiểm tra…</span>
            )}
            {updateStatus.kind === "current" && (
              <span className="settings-meta success">
                <IconCheck size={12} /> Bạn đang dùng phiên bản mới nhất.
              </span>
            )}
            {updateStatus.kind === "available" && (
              <div className="settings-update-available">
                <span>
                  Có bản mới: <strong>v{updateStatus.latest}</strong>
                </span>
                <button
                  type="button"
                  className="modal-btn primary"
                  onClick={() => onOpenReleasePage(updateStatus.releaseUrl)}
                >
                  <IconExternal size={12} /> Mở trang tải
                </button>
              </div>
            )}
            {updateStatus.kind === "error" && (
              <span className="settings-meta danger">{updateStatus.message}</span>
            )}
          </div>
        </section>

        <section className="settings-section">
          <h4 className="settings-section-title">Backup & khôi phục</h4>
          <p className="settings-help">
            <strong>Cấu hình</strong> chỉ chứa workspace và profile (không bao gồm cookie). <strong>Full backup</strong> kèm session đăng nhập.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className="modal-btn"
              onClick={onExportConfig}
              disabled={backupBusy !== "idle"}
            >
              <IconDownload size={12} /> Xuất cấu hình (.json)
            </button>
            <button
              type="button"
              className="modal-btn"
              onClick={onImportConfig}
              disabled={backupBusy !== "idle"}
            >
              <IconUpload size={12} /> Nhập cấu hình
            </button>
          </div>
          <div className="settings-actions">
            <button
              type="button"
              className="modal-btn"
              onClick={onExportFullBackup}
              disabled={backupBusy !== "idle" || !isTauriRuntime()}
              title={!isTauriRuntime() ? "Chỉ chạy trong app desktop" : undefined}
            >
              <IconDownload size={12} /> Full backup (.zip)
            </button>
            <button
              type="button"
              className="modal-btn"
              onClick={onRestoreFullBackup}
              disabled={backupBusy !== "idle" || !isTauriRuntime()}
              title={!isTauriRuntime() ? "Chỉ chạy trong app desktop" : undefined}
            >
              <IconUpload size={12} /> Khôi phục từ backup
            </button>
          </div>
        </section>

        <footer className="settings-footer">
          <a
            href={`https://github.com/${GITHUB_REPO}`}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault();
              onOpenReleasePage(`https://github.com/${GITHUB_REPO}`);
            }}
          >
            GitHub
          </a>
          <span className="settings-meta">v{APP_VERSION}</span>
        </footer>
      </div>
    </div>
  );
}
