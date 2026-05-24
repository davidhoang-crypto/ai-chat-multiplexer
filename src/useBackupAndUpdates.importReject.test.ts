import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Isolated test file to cover the .catch arrows on dynamic import("@tauri-apps/plugin-fs")
// in useBackupAndUpdates.ts (anonymous_5 line 122, anonymous_7 line 164, anonymous_16 line 248).
// These arrows fire only when the dynamic plugin-fs import itself rejects — we force that
// here without affecting the main useBackupAndUpdates.test.ts mock setup.

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

// CRITICAL: make the plugin-fs import itself reject so the .catch arrow fires.
vi.mock("@tauri-apps/plugin-fs", () => {
  throw new Error("plugin-fs unavailable");
});

vi.mock("./appCore", async () => {
  const actual = await vi.importActual<typeof import("./appCore")>("./appCore");
  return {
    ...actual,
    isTauriRuntime: () => true,
  };
});

import { useBackupAndUpdates } from "./hooks/useBackupAndUpdates";
import type { AppState } from "./appCore";

function makeState(): AppState {
  return {
    workspaces: [
      {
        id: "ws1",
        name: "WS1",
        columns: 1,
        panes: [
          {
            id: "p1",
            title: "P1",
            profileId: "prof-default",
            activeTabId: "t1",
            tabs: [{ id: "t1", title: "Tab", url: "https://x", loadedUrl: "https://x" }],
          },
        ],
      },
    ],
    activeWorkspaceId: "ws1",
    profiles: [{ id: "prof-default", name: "Default" }],
  };
}

function setupHook() {
  const setState = vi.fn();
  const setFocusedPaneId = vi.fn();
  const setConfirmDialog = vi.fn();
  const { result } = renderHook(() =>
    useBackupAndUpdates({
      state: makeState(),
      setState,
      setFocusedPaneId,
      setConfirmDialog,
    }),
  );
  return { result, setConfirmDialog };
}

describe("useBackupAndUpdates — dynamic plugin-fs import rejection", () => {
  beforeEach(() => {
    invokeSpy.mockReset();
    rejectingCommands.clear();
    dialogSave.mockReset();
    dialogOpen.mockReset();
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exportConfigJson .catch returns null when plugin-fs import rejects (anonymous_5)", async () => {
    dialogSave.mockResolvedValue("C:/cfg.json");
    rejectingCommands.add("plugin:fs|write_text_file");
    const alertSpy = vi.spyOn(window, "alert");
    const { result } = setupHook();
    await act(async () => {
      await result.current.exportConfigJson();
    });
    // The inner import().catch arrow returns { writeTextFile: null } so the hook
    // throws "không khả dụng" which is alerted.
    expect(alertSpy).toHaveBeenCalled();
    expect(result.current.backupBusy).toBe("idle");
  });

  it("importConfigJson .catch returns null when plugin-fs import rejects (anonymous_7)", async () => {
    dialogOpen.mockResolvedValue("C:/cfg.json");
    const alertSpy = vi.spyOn(window, "alert");
    const { result } = setupHook();
    await act(async () => {
      await result.current.importConfigJson();
    });
    // import().catch arrow returns { readTextFile: null } so the hook throws
    // "không khả dụng" which is alerted.
    expect(alertSpy).toHaveBeenCalled();
    expect(result.current.backupBusy).toBe("idle");
  });

  it("exportFullBackup .catch returns null when plugin-fs import rejects (anonymous_16)", async () => {
    dialogSave.mockResolvedValue("C:/backup.zip");
    invokeSpy.mockResolvedValue(undefined);
    const alertSpy = vi.spyOn(window, "alert");
    const { result } = setupHook();
    await act(async () => {
      await result.current.exportFullBackup();
    });
    // import().catch arrow returns { writeTextFile: null }; the if(writeTextFile)
    // branch is skipped, then backup_sessions_zip is invoked and the success alert fires.
    expect(alertSpy).toHaveBeenCalled();
    expect(result.current.backupBusy).toBe("idle");
  });
});
