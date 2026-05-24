import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const invokeSpy = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeSpy(cmd, args),
}));

let tauriRuntime = false;
vi.mock("./appCore", async () => {
  const actual = await vi.importActual<typeof import("./appCore")>("./appCore");
  return {
    ...actual,
    isTauriRuntime: () => tauriRuntime,
  };
});

import { useBackupAndUpdates } from "./hooks/useBackupAndUpdates";
import type { AppState } from "./appCore";
import { APP_VERSION } from "./appCore";

function makeState(): AppState {
  return {
    workspaces: [
      {
        id: "ws1",
        name: "WS1",
        columns: 2,
        panes: [
          {
            id: "p1",
            title: "P1",
            profileId: "prof-default",
            activeTabId: "t1",
            tabs: [
              {
                id: "t1",
                title: "Tab",
                url: "https://example.com",
                loadedUrl: "https://example.com",
              },
            ],
          },
        ],
      },
    ],
    activeWorkspaceId: "ws1",
    profiles: [{ id: "prof-default", name: "Default" }],
  };
}

interface SetupResult {
  state: AppState;
  result: ReturnType<typeof renderHook<ReturnType<typeof useBackupAndUpdates>, unknown>>["result"];
  setStateSpy: ReturnType<typeof vi.fn>;
  setFocusedPaneId: ReturnType<typeof vi.fn>;
  setConfirmDialog: ReturnType<typeof vi.fn>;
}

function setupHook(initial?: AppState): SetupResult {
  const state = initial ?? makeState();
  const setStateSpy = vi.fn();
  const setFocusedPaneId = vi.fn();
  const setConfirmDialog = vi.fn();
  const { result } = renderHook(() =>
    useBackupAndUpdates({
      state,
      setState: setStateSpy,
      setFocusedPaneId,
      setConfirmDialog,
    }),
  );
  return { state, result, setStateSpy, setFocusedPaneId, setConfirmDialog };
}

describe("useBackupAndUpdates", () => {
  beforeEach(() => {
    tauriRuntime = false;
    invokeSpy.mockReset();
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkForUpdates", () => {
    it("returns 'available' when GitHub release tag is newer than APP_VERSION", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ tag_name: "v99.0.0", html_url: "https://example/r" }),
      } as Response);
      const { result } = setupHook();

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.updateStatus).toEqual({
        kind: "available",
        latest: "99.0.0",
        releaseUrl: "https://example/r",
      });
    });

    it("returns 'current' when latest tag is not newer", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ tag_name: APP_VERSION }),
      } as Response);
      const { result } = setupHook();

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.updateStatus).toEqual({ kind: "current" });
    });

    it("returns 'error' when fetch responds with non-ok status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);
      const { result } = setupHook();

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.updateStatus.kind).toBe("error");
    });

    it("returns 'error' when tag_name is missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
      const { result } = setupHook();

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.updateStatus.kind).toBe("error");
    });

    it("returns 'error' on network exception", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const { result } = setupHook();

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.updateStatus).toEqual({ kind: "error", message: "offline" });
    });
  });

  describe("openReleasePage", () => {
    it("calls window.open in browser runtime", async () => {
      const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
      const { result } = setupHook();

      await act(async () => {
        await result.current.openReleasePage("https://example/release");
      });

      expect(openSpy).toHaveBeenCalledWith("https://example/release", "_blank", "noopener");
    });
  });

  describe("exportConfigJson (browser)", () => {
    it("creates a blob URL and triggers download", async () => {
      const createObjectURL = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:mock");
      const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
      const clickSpy = vi.fn();
      const realCreate = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = realCreate(tag) as HTMLAnchorElement;
        if (tag === "a") {
          (el as HTMLAnchorElement & { click: () => void }).click = clickSpy;
        }
        return el;
      });

      const { result } = setupHook();

      await act(async () => {
        await result.current.exportConfigJson();
      });

      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
      expect(result.current.backupBusy).toBe("idle");
    });
  });

  describe("importConfigJson (browser)", () => {
    function mockFileInput(text: string | null) {
      const realCreate = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = realCreate(tag) as HTMLInputElement;
        if (tag === "input") {
          (el as HTMLInputElement).click = () => {
            queueMicrotask(() => {
              if (text === null) {
                Object.defineProperty(el, "files", { value: [], configurable: true });
              } else {
                const file = new File([text], "config.json", { type: "application/json" });
                Object.defineProperty(el, "files", { value: [file], configurable: true });
              }
              el.onchange?.(new Event("change"));
            });
          };
        }
        return el;
      });
    }

    it("parses JSON then opens confirm dialog and applies on confirm", async () => {
      const incoming: AppState = {
        workspaces: [
          {
            id: "ws-new",
            name: "Imported",
            columns: 1,
            panes: [
              {
                id: "p-new",
                title: "P",
                profileId: "prof-default",
                activeTabId: "t",
                tabs: [
                  {
                    id: "t",
                    title: "T",
                    url: "https://x",
                    loadedUrl: "https://x",
                  },
                ],
              },
            ],
          },
        ],
        activeWorkspaceId: "ws-new",
        profiles: [{ id: "prof-default", name: "Default" }],
      };
      mockFileInput(JSON.stringify(incoming));
      const { result, setStateSpy, setConfirmDialog, setFocusedPaneId } = setupHook();

      await act(async () => {
        await result.current.importConfigJson();
      });

      await waitFor(() => expect(setConfirmDialog).toHaveBeenCalled());
      const dialog = setConfirmDialog.mock.calls[0][0];
      expect(dialog.danger).toBe(true);

      act(() => dialog.onConfirm());

      expect(setStateSpy).toHaveBeenCalled();
      const applied = setStateSpy.mock.calls[0][0] as AppState;
      expect(applied.workspaces[0].id).toBe("ws-new");
      expect(setFocusedPaneId).toHaveBeenCalledWith(null);
    });

    it("alerts on invalid JSON without calling setConfirmDialog", async () => {
      mockFileInput("{ not json");
      const alertSpy = vi.spyOn(window, "alert");
      const { result, setConfirmDialog } = setupHook();

      await act(async () => {
        await result.current.importConfigJson();
      });

      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      expect(setConfirmDialog).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });

    it("alerts when file lacks workspaces array", async () => {
      mockFileInput(JSON.stringify({ workspaces: [], profiles: [] }));
      const alertSpy = vi.spyOn(window, "alert");
      const { result, setConfirmDialog } = setupHook();

      await act(async () => {
        await result.current.importConfigJson();
      });

      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      expect(setConfirmDialog).not.toHaveBeenCalled();
    });
  });

  describe("desktop-only guards", () => {
    it("exportFullBackup alerts and returns when not in Tauri runtime", async () => {
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();

      await act(async () => {
        await result.current.exportFullBackup();
      });

      expect(alertSpy).toHaveBeenCalled();
      expect(invokeSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });

    it("restoreFullBackup alerts and returns when not in Tauri runtime", async () => {
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();

      await act(async () => {
        await result.current.restoreFullBackup();
      });

      expect(alertSpy).toHaveBeenCalled();
      expect(invokeSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });
  });
});
