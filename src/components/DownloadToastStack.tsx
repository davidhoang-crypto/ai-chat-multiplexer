import { IconCheck, IconDownload, IconX } from "../Icons";
import type { DownloadToast } from "../appCore";

type Props = {
  toasts: DownloadToast[];
  onDismiss: (id: string) => void;
  onOpenFile: (path: string) => void;
  onRevealFolder: (path: string) => void;
};

export function DownloadToastStack({ toasts, onDismiss, onOpenFile, onRevealFolder }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="download-toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`download-toast download-toast-${toast.status}`}>
          <div className="download-toast-icon" aria-hidden="true">
            {toast.status === "downloading" ? (
              <IconDownload size={14} />
            ) : toast.status === "success" ? (
              <IconCheck size={14} />
            ) : (
              <IconX size={14} />
            )}
          </div>
          <div className="download-toast-body">
            <div className="download-toast-title">
              {toast.status === "downloading"
                ? "Đang tải…"
                : toast.status === "success"
                  ? "Đã tải xong"
                  : "Tải lỗi"}
            </div>
            <div className="download-toast-name" title={toast.path ?? toast.fileName}>
              {toast.fileName}
            </div>
            {toast.status === "success" && toast.path && (
              <div className="download-toast-actions">
                <button
                  type="button"
                  className="download-toast-link"
                  onClick={() => onOpenFile(toast.path!)}
                >
                  Mở file
                </button>
                <span className="download-toast-sep">·</span>
                <button
                  type="button"
                  className="download-toast-link"
                  onClick={() => onRevealFolder(toast.path!)}
                >
                  Mở folder
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="download-toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Đóng"
          >
            <IconX size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
