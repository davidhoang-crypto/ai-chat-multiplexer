import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// Capture the registered handler so tests can emit synthetic events.
type EventHandler = (event: { payload: unknown }) => void;
let registered: EventHandler | null = null;
const unlistenSpy = vi.fn();
const invokeSpy = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_name: string, handler: EventHandler) => {
    registered = handler;
    return unlistenSpy;
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeSpy(cmd, args),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(async () => undefined),
}));

vi.mock("./appCore", async () => {
  const actual = await vi.importActual<typeof import("./appCore")>("./appCore");
  return {
    ...actual,
    isTauriRuntime: () => tauriRuntimeFlag,
  };
});

let tauriRuntimeFlag = true;

import { useDownloadManager } from "./hooks/useDownloadManager";

describe("useDownloadManager", () => {
  beforeEach(() => {
    registered = null;
    unlistenSpy.mockClear();
    invokeSpy.mockClear();
    tauriRuntimeFlag = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty toast list and hasActiveDownload false", () => {
    const { result } = renderHook(() => useDownloadManager());
    expect(result.current.toasts).toEqual([]);
    expect(result.current.hasActiveDownload).toBe(false);
  });

  it("calls the unlisten cleanup on unmount (line 86)", async () => {
    const { unmount } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());
    unmount();
    // The cleanup awaits the unlisten promise; allow microtasks to flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(unlistenSpy).toHaveBeenCalledTimes(1);
  });

  it("adds a downloading toast on 'started' event", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    act(() => {
      registered!({
        payload: {
          kind: "started",
          label: "pane1",
          url: "https://x/file.zip",
          path: "C:/Users/An/Downloads/file.zip",
        },
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      status: "downloading",
      fileName: "file.zip",
      path: "C:/Users/An/Downloads/file.zip",
    });
    expect(result.current.hasActiveDownload).toBe(true);
  });

  it("transitions toast to 'success' on 'finished' event with success=true", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    act(() => {
      registered!({
        payload: {
          kind: "started",
          label: "pane1",
          url: "https://x/a.zip",
          path: "C:/dl/a.zip",
        },
      });
    });
    act(() => {
      registered!({
        payload: {
          kind: "finished",
          label: "pane1",
          url: "https://x/a.zip",
          path: "C:/dl/a.zip",
          success: true,
        },
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].status).toBe("success");
    expect(result.current.hasActiveDownload).toBe(false);
  });

  it("transitions toast to 'error' on 'finished' with success=false", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    act(() => {
      registered!({
        payload: { kind: "started", label: "p1", url: "u", path: "C:/dl/b.zip" },
      });
      registered!({
        payload: {
          kind: "finished",
          label: "p1",
          url: "u",
          path: "C:/dl/b.zip",
          success: false,
        },
      });
    });

    expect(result.current.toasts[0].status).toBe("error");
  });

  it("auto-dismisses completed toast after 6 seconds", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());
    vi.useFakeTimers();

    act(() => {
      registered!({
        payload: { kind: "started", label: "p1", url: "u", path: "C:/dl/c.zip" },
      });
      registered!({
        payload: {
          kind: "finished",
          label: "p1",
          url: "u",
          path: "C:/dl/c.zip",
          success: true,
        },
      });
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(6001);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("does NOT auto-dismiss in-progress downloads", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());
    vi.useFakeTimers();

    act(() => {
      registered!({
        payload: { kind: "started", label: "p1", url: "u", path: "C:/dl/d.zip" },
      });
    });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].status).toBe("downloading");
  });

  it("ignores 'cancelled' events and does not add toast", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    act(() => {
      registered!({
        payload: { kind: "cancelled", label: "p1", url: "u" },
      });
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("falls back to a path-only match when finished label differs from started label", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    // Start with label "paneA"; finish event arrives with label "paneB" but
    // the same path. The hook should reuse the existing downloading toast
    // (lines 50-51 — path-only fallback finder).
    act(() => {
      registered!({
        payload: {
          kind: "started",
          label: "paneA",
          url: "https://x/file.zip",
          path: "C:/dl/file.zip",
        },
      });
    });
    expect(result.current.toasts).toHaveLength(1);
    const startedId = result.current.toasts[0].id;

    act(() => {
      registered!({
        payload: {
          kind: "finished",
          label: "paneB",
          url: "https://x/file.zip",
          path: "C:/dl/file.zip",
          success: true,
        },
      });
    });
    // Same toast updated to success — no new toast created.
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).toBe(startedId);
    expect(result.current.toasts[0].status).toBe("success");
  });

  it("falls back to label-prefix match when finished event has no path", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    // Started with a known path under label "paneX"; finished event omits path
    // (lines 56-60 — label-prefix scan over downloading toasts).
    act(() => {
      registered!({
        payload: {
          kind: "started",
          label: "paneX",
          url: "https://x/missing.zip",
          path: "C:/dl/missing.zip",
        },
      });
    });
    const startedId = result.current.toasts[0].id;

    act(() => {
      registered!({
        payload: {
          kind: "finished",
          label: "paneX",
          url: "https://x/missing.zip",
          path: null,
          success: false,
        },
      });
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).toBe(startedId);
    expect(result.current.toasts[0].status).toBe("error");
  });

  it("dismissToast removes a specific toast", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    act(() => {
      registered!({
        payload: { kind: "started", label: "p1", url: "u", path: "C:/dl/e.zip" },
      });
      registered!({
        payload: { kind: "started", label: "p2", url: "u2", path: "C:/dl/f.zip" },
      });
    });
    expect(result.current.toasts).toHaveLength(2);

    const firstId = result.current.toasts[0].id;
    act(() => {
      result.current.dismissToast(firstId);
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).not.toBe(firstId);
  });

  it("clearAll empties the toast list", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    act(() => {
      registered!({
        payload: { kind: "started", label: "p1", url: "u", path: "C:/dl/g.zip" },
      });
      registered!({
        payload: { kind: "started", label: "p2", url: "u2", path: "C:/dl/h.zip" },
      });
    });
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.toasts).toEqual([]);
  });

  it("revealFolder invokes the reveal_path_in_folder command", async () => {
    invokeSpy.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    act(() => {
      result.current.revealFolder("C:/dl/i.zip");
    });
    expect(invokeSpy).toHaveBeenCalledWith("reveal_path_in_folder", { path: "C:/dl/i.zip" });
  });

  it("revealFolder swallows invoke rejections without throwing", async () => {
    invokeSpy.mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    act(() => {
      result.current.revealFolder("C:/dl/i.zip");
    });
    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1));
    const errArgs = errorSpy.mock.calls[0] ?? [];
    expect(String(errArgs[errArgs.length - 1])).toMatch(/nope/);
    errorSpy.mockRestore();
  });

  it("openFile invokes the @tauri-apps/plugin-opener openPath", async () => {
    const opener = await import("@tauri-apps/plugin-opener");
    const openPathSpy = opener.openPath as ReturnType<typeof vi.fn>;
    openPathSpy.mockClear();
    openPathSpy.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());
    await act(async () => {
      await result.current.openFile("C:/dl/i.zip");
    });
    expect(openPathSpy).toHaveBeenCalledWith("C:/dl/i.zip");
  });

  it("openFile catches openPath rejection and logs error", async () => {
    const opener = await import("@tauri-apps/plugin-opener");
    const openPathSpy = opener.openPath as ReturnType<typeof vi.fn>;
    openPathSpy.mockClear();
    openPathSpy.mockRejectedValue(new Error("plugin missing"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());
    await act(async () => {
      await result.current.openFile("C:/dl/i.zip");
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errArgs = errorSpy.mock.calls[0] ?? [];
    expect(String(errArgs[errArgs.length - 1])).toMatch(/plugin missing/);
    errorSpy.mockRestore();
  });

  it("does not register a listener when not running in Tauri (line 18)", () => {
    tauriRuntimeFlag = false;
    registered = null;
    renderHook(() => useDownloadManager());
    expect(registered).toBeNull();
  });

  it("creates a new error toast when finished arrives with no matching started (lines 64-66, 72-79)", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    // No prior 'started' event — finished comes alone with no path.
    act(() => {
      registered!({
        payload: {
          kind: "finished",
          label: "ghostPane",
          url: "https://x/orphan.zip",
          path: null,
          success: false,
        },
      });
    });

    // Should create a brand-new toast with the url-derived id, fileName fallback, and createdAt now.
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      id: "ghostPane-https://x/orphan.zip",
      status: "error",
      fileName: "Tải xuống",
      path: null,
    });
    expect(typeof result.current.toasts[0].createdAt).toBe("number");
  });

  it("ignores 'cancelled' events without modifying toast list (line 79)", async () => {
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    act(() => {
      registered!({
        payload: {
          kind: "started",
          label: "p1",
          url: "https://x/c.zip",
          path: "C:/dl/c.zip",
        },
      });
    });
    expect(result.current.toasts).toHaveLength(1);

    // Send a cancelled event — handler is a no-op, list shape stays intact.
    const before = result.current.toasts;
    act(() => {
      registered!({
        payload: {
          kind: "cancelled",
          label: "p1",
          url: "https://x/c.zip",
          path: "C:/dl/c.zip",
        },
      });
    });
    expect(result.current.toasts).toBe(before);
  });

  it("fileNameFromPath returns empty string when path has no filename segment (line 26)", async () => {
    // A path that ends with a slash forces String.match(/[^\\/]+$/) to return null,
    // exercising the right-hand branch of `match ? match[0] : path` (line 26).
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    act(() => {
      registered!({
        payload: {
          kind: "started",
          label: "p1",
          url: "https://x/",
          path: "C:/dl/",
        },
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    // No segment after trailing slash → falls through to return path as-is.
    expect(result.current.toasts[0].fileName).toBe("C:/dl/");
  });

  it("ignores unknown event kinds without modifying toast list (line 79 false branch)", async () => {
    // Line 79 BRDA gap: payload.kind === 'cancelled' false branch (no matching kind at all).
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    act(() => {
      registered!({
        payload: {
          kind: "unknown-future-kind",
          label: "p1",
          url: "https://x/u.zip",
          path: "C:/dl/u.zip",
        },
      });
    });
    expect(result.current.toasts).toEqual([]);
  });

  it("preserves unrelated toasts when finished matches only one of many (line 76 map false branch)", async () => {
    // Line 76 BRDA gap: inside `prev.map((t) => t.id === id ? newToast : t)`,
    // the false branch needs at least one toast whose id !== id.
    const { result } = renderHook(() => useDownloadManager());
    await waitFor(() => expect(registered).not.toBeNull());

    // Register two distinct downloads.
    act(() => {
      registered!({
        payload: {
          kind: "started",
          label: "pane1",
          url: "https://x/a.zip",
          path: "C:/dl/a.zip",
        },
      });
    });
    act(() => {
      registered!({
        payload: {
          kind: "started",
          label: "pane2",
          url: "https://y/b.zip",
          path: "C:/dl/b.zip",
        },
      });
    });
    expect(result.current.toasts).toHaveLength(2);
    const beforeOther = result.current.toasts.find((t) => t.path === "C:/dl/b.zip");
    expect(beforeOther).toBeDefined();

    // Finish only the first download — the second toast must be returned as-is by the
    // ternary's false branch.
    act(() => {
      registered!({
        payload: {
          kind: "finished",
          label: "pane1",
          url: "https://x/a.zip",
          path: "C:/dl/a.zip",
          success: true,
        },
      });
    });

    expect(result.current.toasts).toHaveLength(2);
    const afterOther = result.current.toasts.find((t) => t.path === "C:/dl/b.zip");
    // Reference identity preserved: ternary returned the same object.
    expect(afterOther).toBe(beforeOther);
    const finishedToast = result.current.toasts.find((t) => t.path === "C:/dl/a.zip");
    expect(finishedToast?.status).toBe("success");
  });
});
