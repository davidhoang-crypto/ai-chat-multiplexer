import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { isTauriRuntime, type DownloadEventPayload, type DownloadToast } from "../appCore";

/**
 * Manages the download toast list:
 * - Listens for native-webview-download events from Rust
 * - Builds and dedupes toasts as downloads progress
 * - Auto-dismisses success/error toasts after 6s
 * - Exposes helpers for opening the file or its containing folder
 */
export function useDownloadManager() {
  const [toasts, setToasts] = useState<DownloadToast[]>([]);

  // Listen for download events from the backend.
  useEffect(() => {
    if (!isTauriRuntime()) return;

    const unlistenPromise = listen<DownloadEventPayload>(
      "native-webview-download",
      (event) => {
        const payload = event.payload;
        const fileNameFromPath = (path: string) => {
          const match = path.match(/[^\\/]+$/);
          return match ? match[0] : path;
        };

        if (payload.kind === "started") {
          const id = `${payload.label}-${payload.path}`;
          setToasts((prev) => [
            ...prev.filter((toast) => toast.id !== id),
            {
              id,
              status: "downloading",
              fileName: fileNameFromPath(payload.path),
              path: payload.path,
              createdAt: Date.now(),
            },
          ]);
        } else if (payload.kind === "finished") {
          setToasts((prev) => {
            // Try exact id match first (label + path), then fall back to a
            // path-only match (different webview started the download but the
            // file is the same).
            const targetPath = payload.path;
            const exactId = targetPath ? `${payload.label}-${targetPath}` : null;
            let target = exactId ? prev.find((toast) => toast.id === exactId) : undefined;
            if (!target && targetPath) {
              target = prev.find(
                (toast) => toast.path === targetPath && toast.status === "downloading",
              );
            }
            if (!target) {
              // Last resort: most recent download still in-progress for this label.
              target = [...prev]
                .reverse()
                .find(
                  (toast) =>
                    toast.id.startsWith(`${payload.label}-`) && toast.status === "downloading",
                );
            }

            const id = target?.id ?? exactId ?? `${payload.label}-${payload.url}`;
            const path = payload.path ?? target?.path ?? null;
            const fileName = path ? fileNameFromPath(path) : target?.fileName ?? "Tải xuống";
            const newToast: DownloadToast = {
              id,
              status: payload.success ? "success" : "error",
              fileName,
              path,
              createdAt: target?.createdAt ?? Date.now(),
            };
            const existing = prev.find((toast) => toast.id === id);
            return existing
              ? prev.map((toast) => (toast.id === id ? newToast : toast))
              : [...prev, newToast];
          });
        } else if (payload.kind === "cancelled") {
          // Người dùng huỷ — không cần toast.
        }
      },
    );

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Auto-dismiss completed toasts after 6 seconds.
  useEffect(() => {
    const completed = toasts.filter(
      (toast) => toast.status === "success" || toast.status === "error",
    );
    if (completed.length === 0) return;

    const timers = completed.map((toast) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, 6000),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const revealFolder = useCallback((path: string) => {
    void invoke("reveal_path_in_folder", { path }).catch((error) => {
      console.error("reveal_path_in_folder failed", error);
    });
  }, []);

  const openFile = useCallback(async (path: string) => {
    try {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(path);
    } catch (error) {
      console.error("openPath failed", error);
    }
  }, []);

  return {
    toasts,
    hasActiveDownload: toasts.some((toast) => toast.status === "downloading"),
    dismissToast,
    clearAll,
    revealFolder,
    openFile,
  };
}
