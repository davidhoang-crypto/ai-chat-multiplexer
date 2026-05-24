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
    isTauriRuntime: () => true,
  };
});

import { useDownloadManager } from "./hooks/useDownloadManager";

describe("useDownloadManager", () => {
  beforeEach(() => {
    registered = null;
    unlistenSpy.mockClear();
    invokeSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty toast list and hasActiveDownload false", () => {
    const { result } = renderHook(() => useDownloadManager());
    expect(result.current.toasts).toEqual([]);
    expect(result.current.hasActiveDownload).toBe(false);
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
});
