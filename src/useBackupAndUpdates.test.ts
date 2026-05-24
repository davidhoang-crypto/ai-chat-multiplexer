import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expectCallWithMessage, nthCallFirstArgString } from "./test-utils";

const invokeSpy = vi.fn();
const rejectingCommands = new Set<string>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => {
    if (rejectingCommands.has(cmd)) {
      invokeSpy(cmd, args);
      return Promise.reject(new Error(`${cmd} forced rejection`));
    }
    return invokeSpy(cmd, args);
  },
}));

const dialogSave = vi.fn();
const dialogOpen = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: (opts: unknown) => dialogSave(opts),
  open: (opts: unknown) => dialogOpen(opts),
}));

const writeTextFileSpy = vi.fn();
const readTextFileSpy = vi.fn();
let writeTextFileExportNull = false;
let readTextFileExportNull = false;
vi.mock("@tauri-apps/plugin-fs", () => ({
  get writeTextFile() {
    return writeTextFileExportNull ? null : (p: string, c: string) => writeTextFileSpy(p, c);
  },
  get readTextFile() {
    return readTextFileExportNull ? null : (p: string) => readTextFileSpy(p);
  },
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
    rejectingCommands.clear();
    writeTextFileExportNull = false;
    readTextFileExportNull = false;
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

    it("invokes plugin:opener|open_url in Tauri runtime", async () => {
      tauriRuntime = true;
      const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
      const { result } = setupHook();
      await act(async () => {
        await result.current.openReleasePage("https://example/release");
      });
      expect(invokeSpy).toHaveBeenCalledWith(
        "plugin:opener|open_url",
        expect.objectContaining({ url: "https://example/release" }),
      );
      // Success path: should NOT fall back to window.open.
      expect(openSpy).not.toHaveBeenCalled();
    });

    it("falls back to window.open when Tauri opener invoke rejects", async () => {
      tauriRuntime = true;
      rejectingCommands.add("plugin:opener|open_url");
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

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
      expect(result.current.backupBusy).toBe("idle");
    });
  });

  describe("exportConfigJson (Tauri runtime)", () => {
    beforeEach(() => {
      tauriRuntime = true;
      dialogSave.mockReset();
      writeTextFileSpy.mockReset();
    });

    it("returns to idle when user cancels save dialog", async () => {
      dialogSave.mockResolvedValue(null);
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportConfigJson();
      });
      expect(invokeSpy).not.toHaveBeenCalled();
      expect(writeTextFileSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });

    it("writes via plugin:fs|write_text_file when invoke succeeds", async () => {
      dialogSave.mockResolvedValue("C:/cfg.json");
      invokeSpy.mockResolvedValue(undefined);
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportConfigJson();
      });
      expect(invokeSpy).toHaveBeenCalledWith(
        "plugin:fs|write_text_file",
        expect.objectContaining({ path: "C:/cfg.json" }),
      );
      // Plugin path succeeded so the writeTextFile fallback shouldn't run.
      expect(writeTextFileSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });

    it("falls back to plugin-fs writeTextFile when invoke rejects", async () => {
      dialogSave.mockResolvedValue("C:/cfg.json");
      rejectingCommands.add("plugin:fs|write_text_file");
      writeTextFileSpy.mockResolvedValue(undefined);
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportConfigJson();
      });
      expect(writeTextFileSpy).toHaveBeenCalledWith("C:/cfg.json", expect.any(String));
      expect(result.current.backupBusy).toBe("idle");
    });

    it("alerts when both invoke and writeTextFile fail", async () => {
      dialogSave.mockResolvedValue("C:/cfg.json");
      rejectingCommands.add("plugin:fs|write_text_file");
      writeTextFileSpy.mockRejectedValue(new Error("disk full"));
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportConfigJson();
      });
      expect(alertSpy).toHaveBeenCalledTimes(1);
      const alertMsg = nthCallFirstArgString(alertSpy);
      expect(alertMsg).toMatch(/Export lỗi/);
      expect(alertMsg).toMatch(/disk full/);
      expect(result.current.backupBusy).toBe("idle");
    });

    it("alerts with 'plugin không khả dụng' when writeTextFile export is null (line 129 falsy)", async () => {
      tauriRuntime = true;
      writeTextFileExportNull = true;
      dialogSave.mockResolvedValue("C:/cfg.json");
      rejectingCommands.add("plugin:fs|write_text_file");
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportConfigJson();
      });
      expectCallWithMessage(alertSpy, /không khả dụng/);
      expect(writeTextFileSpy).not.toHaveBeenCalled();
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

      expect(setStateSpy).toHaveBeenCalledTimes(1);
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

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      expectCallWithMessage(alertSpy, /Import lỗi/);
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

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      expectCallWithMessage(alertSpy, /không có workspaces|workspaces|hợp lệ|lỗi/i);
      expect(setConfirmDialog).not.toHaveBeenCalled();
    });

    it("returns idle when user cancels the file picker (no file selected)", async () => {
      mockFileInput(null);
      const { result, setConfirmDialog } = setupHook();
      const alertSpy = vi.spyOn(window, "alert");

      await act(async () => {
        await result.current.importConfigJson();
      });

      // The "no file" path resolves with null which makes text empty,
      // so importConfigJson returns to idle without confirm dialog or alert.
      expect(setConfirmDialog).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });
  });

  describe("importConfigJson (Tauri runtime)", () => {
    beforeEach(() => {
      tauriRuntime = true;
      dialogOpen.mockReset();
      readTextFileSpy.mockReset();
    });

    it("reads file via plugin-fs and opens confirm dialog on valid JSON", async () => {
      const incoming: AppState = {
        workspaces: [
          {
            id: "ws-imp",
            name: "Imported",
            columns: 1,
            panes: [
              {
                id: "p-imp",
                title: "P",
                profileId: "prof-default",
                activeTabId: "t",
                tabs: [
                  { id: "t", title: "T", url: "https://x", loadedUrl: "https://x" },
                ],
              },
            ],
          },
        ],
        activeWorkspaceId: "ws-imp",
        profiles: [{ id: "prof-default", name: "Default" }],
      };
      dialogOpen.mockResolvedValue("C:/tmp/config.json");
      readTextFileSpy.mockResolvedValue(JSON.stringify(incoming));

      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.importConfigJson();
      });
      expect(readTextFileSpy).toHaveBeenCalledWith("C:/tmp/config.json");
      expect(setConfirmDialog).toHaveBeenCalledTimes(1);
      const dialogArg = setConfirmDialog.mock.calls[0][0];
      expect(dialogArg).toEqual(
        expect.objectContaining({
          onConfirm: expect.any(Function),
        }),
      );
    });

    it("returns idle when user cancels the open dialog", async () => {
      dialogOpen.mockResolvedValue(null);
      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.importConfigJson();
      });
      expect(setConfirmDialog).not.toHaveBeenCalled();
      expect(readTextFileSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });

    it("alerts when readTextFile rejects (outer try/catch)", async () => {
      dialogOpen.mockResolvedValue("C:/tmp/config.json");
      readTextFileSpy.mockRejectedValue(new Error("read failed"));
      const alertSpy = vi.spyOn(window, "alert");
      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.importConfigJson();
      });
      expect(setConfirmDialog).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledTimes(1);
      const alertMsg = nthCallFirstArgString(alertSpy);
      expect(alertMsg).toMatch(/Import lỗi/);
      expect(alertMsg).toMatch(/read failed/);
      expect(result.current.backupBusy).toBe("idle");
    });

    it("alerts with 'plugin không khả dụng' when readTextFile export is null (line 167 truthy)", async () => {
      // BRDA gap: line 167 `if (!readTextFile) throw ...` — true branch.
      dialogOpen.mockResolvedValue("C:/tmp/config.json");
      readTextFileExportNull = true;
      const alertSpy = vi.spyOn(window, "alert");
      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.importConfigJson();
      });
      expect(setConfirmDialog).not.toHaveBeenCalled();
      expectCallWithMessage(alertSpy, /không khả dụng/);
      expect(readTextFileSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });
  });

  describe("desktop-only guards", () => {
    it("exportFullBackup alerts and returns when not in Tauri runtime", async () => {
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();

      await act(async () => {
        await result.current.exportFullBackup();
      });

      expectCallWithMessage(alertSpy, /desktop|app/i);
      expect(invokeSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });

    it("restoreFullBackup alerts and returns when not in Tauri runtime", async () => {
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();

      await act(async () => {
        await result.current.restoreFullBackup();
      });

      expectCallWithMessage(alertSpy, /desktop|app/i);
      expect(invokeSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });
  });

  describe("exportFullBackup (Tauri runtime)", () => {
    beforeEach(() => {
      tauriRuntime = true;
      dialogSave.mockReset();
      writeTextFileSpy.mockReset();
    });

    it("returns idle without invoking when user cancels save dialog", async () => {
      dialogSave.mockResolvedValue(null);
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportFullBackup();
      });
      expect(invokeSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });

    it("writes config json and invokes backup_sessions_zip on success", async () => {
      dialogSave.mockResolvedValue("C:/tmp/backup.zip");
      writeTextFileSpy.mockResolvedValue(undefined);
      invokeSpy.mockResolvedValue(undefined);
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportFullBackup();
      });
      expect(writeTextFileSpy).toHaveBeenCalledWith(
        "C:/tmp/backup.json",
        expect.stringContaining("workspaces"),
      );
      expect(invokeSpy).toHaveBeenCalledWith("backup_sessions_zip", {
        outputPath: "C:/tmp/backup.zip",
      });
      expectCallWithMessage(alertSpy, /Backup/i);
      expect(result.current.backupBusy).toBe("idle");
    });

    it("alerts when invoke throws", async () => {
      dialogSave.mockResolvedValue("C:/tmp/backup.zip");
      writeTextFileSpy.mockResolvedValue(undefined);
      invokeSpy.mockRejectedValue(new Error("boom"));
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportFullBackup();
      });
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Backup lỗi"));
      expect(result.current.backupBusy).toBe("idle");
    });

    it("skips writeTextFile when plugin-fs export is null (line 251 falsy)", async () => {
      writeTextFileExportNull = true;
      dialogSave.mockResolvedValue("C:/tmp/backup.zip");
      invokeSpy.mockResolvedValue(undefined);
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportFullBackup();
      });
      // writeTextFileSpy should NOT have been called when export is null
      expect(writeTextFileSpy).not.toHaveBeenCalled();
      // Backup still proceeds
      expect(invokeSpy).toHaveBeenCalledWith("backup_sessions_zip", {
        outputPath: "C:/tmp/backup.zip",
      });
      expectCallWithMessage(alertSpy, /Backup/i);
      expect(result.current.backupBusy).toBe("idle");
    });

    it("returns idle without invoking when user cancels save dialog (top-level early return)", async () => {
      dialogSave.mockResolvedValue(null);
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportFullBackup();
      });
      expect(invokeSpy).not.toHaveBeenCalled();
      expect(writeTextFileSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });

    it("alerts when not in Tauri runtime (early return path)", async () => {
      tauriRuntime = false;
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportFullBackup();
      });
      expectCallWithMessage(alertSpy, /desktop|app/i);
      expect(invokeSpy).not.toHaveBeenCalled();
    });
  });

  describe("restoreFullBackup (Tauri runtime)", () => {
    beforeEach(() => {
      tauriRuntime = true;
      dialogOpen.mockReset();
    });

    it("returns idle without confirming when user cancels open dialog", async () => {
      dialogOpen.mockResolvedValue(null);
      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.restoreFullBackup();
      });
      expect(setConfirmDialog).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });

    it("opens confirm dialog and invokes restore_sessions_zip on confirm", async () => {
      dialogOpen.mockResolvedValue("C:/tmp/in.zip");
      invokeSpy.mockResolvedValue(undefined);
      const alertSpy = vi.spyOn(window, "alert");
      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.restoreFullBackup();
      });
      expect(setConfirmDialog).toHaveBeenCalledTimes(1);
      const dialogArg = setConfirmDialog.mock.calls[0][0];
      await act(async () => {
        await dialogArg.onConfirm();
      });
      expect(invokeSpy).toHaveBeenCalledWith("restore_sessions_zip", {
        inputPath: "C:/tmp/in.zip",
      });
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("restore"));
    });

    it("dialog onConfirm alerts on invoke error", async () => {
      dialogOpen.mockResolvedValue("C:/tmp/in.zip");
      const alertSpy = vi.spyOn(window, "alert");
      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.restoreFullBackup();
      });
      const dialogArg = setConfirmDialog.mock.calls[0][0];
      invokeSpy.mockRejectedValueOnce(new Error("nope"));
      await act(async () => {
        await dialogArg.onConfirm();
      });
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Restore lỗi"));
    });

    it("alerts when dialog.open itself rejects (outer try/catch)", async () => {
      dialogOpen.mockRejectedValueOnce(new Error("dialog blocked"));
      const alertSpy = vi.spyOn(window, "alert");
      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.restoreFullBackup();
      });
      expect(setConfirmDialog).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Restore lỗi"));
      expect(result.current.backupBusy).toBe("idle");
    });
  });

  describe("non-Error error coercion (String(error) ternary branches)", () => {
    it("checkForUpdates with non-Error rejection coerces to String (line 86 false branch)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue("network down" as unknown as Error);
      const { result } = setupHook();
      await act(async () => {
        await result.current.checkForUpdates();
      });
      expect(result.current.updateStatus).toEqual({
        kind: "error",
        message: "network down",
      });
    });

    it("exportConfigJson with non-Error coerces to String (line 142 false branch)", async () => {
      const alertSpy = vi.spyOn(window, "alert");
      const original = URL.createObjectURL;
      (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => {
        throw "blob denied"; // non-Error
      };
      try {
        const { result } = setupHook();
        await act(async () => {
          await result.current.exportConfigJson();
        });
        expectCallWithMessage(alertSpy, /blob denied/);
        expect(result.current.backupBusy).toBe("idle");
      } finally {
        (URL as unknown as { createObjectURL: typeof original }).createObjectURL = original;
      }
    });

    it("importConfigJson with non-Error rejection coerces to String (line 223 false branch)", async () => {
      tauriRuntime = true;
      dialogOpen.mockResolvedValue("C:/cfg.json");
      readTextFileSpy.mockRejectedValue("read denied" as unknown as Error);
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();
      await act(async () => {
        await result.current.importConfigJson();
      });
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("read denied"));
      expect(result.current.backupBusy).toBe("idle");
    });

    it("exportFullBackup with non-Error rejection coerces to String (line 259 false branch)", async () => {
      tauriRuntime = true;
      dialogSave.mockRejectedValue("save denied" as unknown as Error);
      const alertSpy = vi.spyOn(window, "alert");
      const { result } = setupHook();
      await act(async () => {
        await result.current.exportFullBackup();
      });
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("save denied"));
      expect(result.current.backupBusy).toBe("idle");
    });

    it("restoreFullBackup outer with non-Error rejection coerces to String (line 298 false branch)", async () => {
      tauriRuntime = true;
      dialogOpen.mockRejectedValueOnce("denied" as unknown as Error);
      const alertSpy = vi.spyOn(window, "alert");
      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.restoreFullBackup();
      });
      expect(setConfirmDialog).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("denied"));
    });

    it("restoreFullBackup onConfirm with non-Error rejection coerces to String (line 293 false branch)", async () => {
      tauriRuntime = true;
      dialogOpen.mockResolvedValue("C:/tmp/in.zip");
      const alertSpy = vi.spyOn(window, "alert");
      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.restoreFullBackup();
      });
      const dialogArg = setConfirmDialog.mock.calls[0][0];
      invokeSpy.mockRejectedValueOnce("zip rejected" as unknown as Error);
      await act(async () => {
        await dialogArg.onConfirm();
      });
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("zip rejected"));
    });
  });

  describe("importConfigJson edge cases (Tauri runtime)", () => {
    beforeEach(() => {
      tauriRuntime = true;
      dialogOpen.mockReset();
      readTextFileSpy.mockReset();
    });

    it("returns idle when filePath is a non-string truthy value (line 167 typeof branch)", async () => {
      dialogOpen.mockResolvedValue([{ path: "some" }] as unknown as string);
      const { result, setConfirmDialog } = setupHook();
      await act(async () => {
        await result.current.importConfigJson();
      });
      expect(setConfirmDialog).not.toHaveBeenCalled();
      expect(readTextFileSpy).not.toHaveBeenCalled();
      expect(result.current.backupBusy).toBe("idle");
    });

    it("onConfirm uses createDefaultProfiles when parsed.profiles is missing (line 203 false branch)", async () => {
      const incoming = {
        workspaces: [
          {
            id: "ws-imp",
            name: "Imp",
            columns: 1,
            panes: [
              {
                id: "p-imp",
                title: "P",
                profileId: "prof-default",
                activeTabId: "t",
                tabs: [
                  { id: "t", title: "T", url: "https://x", loadedUrl: "https://x" },
                ],
              },
            ],
          },
        ],
        activeWorkspaceId: "ws-imp",
      };
      dialogOpen.mockResolvedValue("C:/cfg.json");
      readTextFileSpy.mockResolvedValue(JSON.stringify(incoming));
      const { result, setConfirmDialog, setStateSpy } = setupHook();
      await act(async () => {
        await result.current.importConfigJson();
      });
      const dialogArg = setConfirmDialog.mock.calls[0][0];
      act(() => {
        dialogArg.onConfirm();
      });
      expect(setStateSpy).toHaveBeenCalledTimes(1);
      const newState = setStateSpy.mock.calls[0][0];
      expect(Array.isArray(newState.profiles)).toBe(true);
      expect(newState.profiles.length).toBeGreaterThan(0);
    });

    it("onConfirm falls back profileId to default when profile id missing (line 211 false branch)", async () => {
      const incoming = {
        workspaces: [
          {
            id: "ws-imp",
            name: "Imp",
            columns: 1,
            panes: [
              {
                id: "p-imp",
                title: "P",
                profileId: "missing-prof",
                activeTabId: "t",
                tabs: [
                  { id: "t", title: "T", url: "https://x", loadedUrl: "https://x" },
                ],
              },
            ],
          },
        ],
        activeWorkspaceId: "ws-imp",
        profiles: [{ id: "prof-default", name: "Default" }],
      };
      dialogOpen.mockResolvedValue("C:/cfg.json");
      readTextFileSpy.mockResolvedValue(JSON.stringify(incoming));
      const { result, setConfirmDialog, setStateSpy } = setupHook();
      await act(async () => {
        await result.current.importConfigJson();
      });
      const dialogArg = setConfirmDialog.mock.calls[0][0];
      act(() => {
        dialogArg.onConfirm();
      });
      const newState = setStateSpy.mock.calls[0][0];
      const importedPane = newState.workspaces[0].panes[0];
      expect(importedPane.profileId).not.toBe("missing-prof");
    });

    it("onConfirm uses [] fallback when pane.tabs is undefined (line 212 false branch)", async () => {
      const incoming = {
        workspaces: [
          {
            id: "ws-imp",
            name: "Imp",
            columns: 1,
            panes: [
              {
                id: "p-imp",
                title: "P",
                profileId: "prof-default",
                activeTabId: "t",
                // tabs intentionally omitted → pane.tabs ?? []
              },
            ],
          },
        ],
        activeWorkspaceId: "ws-imp",
        profiles: [{ id: "prof-default", name: "Default" }],
      };
      dialogOpen.mockResolvedValue("C:/cfg.json");
      readTextFileSpy.mockResolvedValue(JSON.stringify(incoming));
      const { result, setConfirmDialog, setStateSpy } = setupHook();
      await act(async () => {
        await result.current.importConfigJson();
      });
      const dialogArg = setConfirmDialog.mock.calls[0][0];
      act(() => {
        dialogArg.onConfirm();
      });
      const newState = setStateSpy.mock.calls[0][0];
      const importedPane = newState.workspaces[0].panes[0];
      expect(Array.isArray(importedPane.tabs)).toBe(true);
    });

    it("onConfirm picks first workspace as active when activeWorkspaceId is missing (line 215 false branch)", async () => {
      const incoming = {
        workspaces: [
          {
            id: "ws-A",
            name: "A",
            columns: 1,
            panes: [
              {
                id: "pa",
                title: "P",
                profileId: "prof-default",
                activeTabId: "t",
                tabs: [{ id: "t", title: "T", url: "https://x", loadedUrl: "https://x" }],
              },
            ],
          },
          {
            id: "ws-B",
            name: "B",
            columns: 1,
            panes: [
              {
                id: "pb",
                title: "P",
                profileId: "prof-default",
                activeTabId: "t",
                tabs: [{ id: "t", title: "T", url: "https://y", loadedUrl: "https://y" }],
              },
            ],
          },
        ],
        activeWorkspaceId: "ws-NOT-PRESENT",
        profiles: [{ id: "prof-default", name: "Default" }],
      };
      dialogOpen.mockResolvedValue("C:/cfg.json");
      readTextFileSpy.mockResolvedValue(JSON.stringify(incoming));
      const { result, setConfirmDialog, setStateSpy } = setupHook();
      await act(async () => {
        await result.current.importConfigJson();
      });
      const dialogArg = setConfirmDialog.mock.calls[0][0];
      act(() => {
        dialogArg.onConfirm();
      });
      const newState = setStateSpy.mock.calls[0][0];
      expect(newState.activeWorkspaceId).toBe("ws-A");
    });
  });
});
