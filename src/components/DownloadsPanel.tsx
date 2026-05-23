import { IconCheck, IconDownload, IconX } from "../Icons";
import type { DownloadToast } from "../appCore";

type Props = {
  open: boolean;
  items: DownloadToast[];
  onClose: () => void;
  onClearAll: () => void;
  onOpenFile: (path: string) => void;
  onRevealFolder: (path: string) => void;
};

export function DownloadsPanel({
  open,
  items,
  onClose,
  onClearAll,
  onOpenFile,
  onRevealFolder,
}: Props) {
  if (!open) return null;

  return (
    <div className="downloads-panel" role="dialog" aria-label="Tải xuống">
      <header className="downloads-panel-header">
        <h3 className="modal-title">Tải xuống</h3>
        <div className="downloads-panel-actions">
          {items.length > 0 && (
            <button
              type="button"
              className="modal-btn"
              onClick={onClearAll}
              title="Xóa danh sách"
            >
              Xóa hết
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            <IconX size={14} />
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="downloads-empty">Chưa có file nào được tải.</div>
      ) : (
        <ul className="downloads-list">
          {[...items]
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((item) => (
              <li key={item.id} className={`downloads-item downloads-item-${item.status}`}>
                <div className="downloads-item-icon" aria-hidden="true">
                  {item.status === "downloading" ? (
                    <IconDownload size={14} />
                  ) : item.status === "success" ? (
                    <IconCheck size={14} />
                  ) : (
                    <IconX size={14} />
                  )}
                </div>
                <div className="downloads-item-body">
                  <div className="downloads-item-name" title={item.path ?? item.fileName}>
                    {item.fileName}
                  </div>
                  <div className="downloads-item-meta">
                    {item.status === "downloading" && (
                      <>
                        <span className="downloads-progress">
                          <span className="downloads-progress-bar" />
                        </span>
                        <span className="downloads-status downloading">Đang tải…</span>
                      </>
                    )}
                    {item.status === "success" && (
                      <span className="downloads-status success">Hoàn tất</span>
                    )}
                    {item.status === "error" && (
                      <span className="downloads-status error">Lỗi</span>
                    )}
                    {item.status === "cancelled" && (
                      <span className="downloads-status">Đã hủy</span>
                    )}
                  </div>
                  {item.status === "success" && item.path && (
                    <div className="downloads-item-actions">
                      <button
                        type="button"
                        className="download-toast-link"
                        onClick={() => onOpenFile(item.path!)}
                      >
                        Mở file
                      </button>
                      <span className="download-toast-sep">·</span>
                      <button
                        type="button"
                        className="download-toast-link"
                        onClick={() => onRevealFolder(item.path!)}
                      >
                        Mở folder
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
