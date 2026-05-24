import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";

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

import { useProfileWorkspaceActions } from "./hooks/useProfileWorkspaceActions";
import type { AppState, ChatPane, Profile, Workspace } from "./appCore";
import type { ConfirmDialogOptions, TextPromptOptions } from "./types/dialogs";

function makePane(id: string, profileId: string): ChatPane {
  return {
    id,
    title: `Pane ${id}`,
    profileId,
    activeTabId: `${id}-t1`,
    tabs: [
      {
        id: `${id}-t1`,
        title: "Tab",
        url: "https://example.com",
        loadedUrl: "https://example.com",
      },
    ],
  };
}

function makeWorkspace(id: string, panes: ChatPane[]): Workspace {
  return { id, name: `Workspace ${id}`, columns: 2, panes };
}

function makeState(workspaces: Workspace[], activeId: string, profiles: Profile[]): AppState {
  return { workspaces, activeWorkspaceId: activeId, profiles };
}

interface Harness {
  state: AppState;
  actions: ReturnType<typeof useProfileWorkspaceActions>;
  setFocusedPaneId: ReturnType<typeof vi.fn>;
  setConfirmDialog: ReturnType<typeof vi.fn>;
  openTextPrompt: ReturnType<typeof vi.fn>;
  capturedPrompt: TextPromptOptions | null;
  capturedConfirm: ConfirmDialogOptions | null;
}

function setupHook(initial: AppState) {
  let capturedPrompt: TextPromptOptions | null = null;
  let capturedConfirm: ConfirmDialogOptions | null = null;
  const openTextPrompt = vi.fn((opts: TextPromptOptions) => {
    capturedPrompt = opts;
  });
  const setConfirmDialog = vi.fn((dialog: ConfirmDialogOptions | null) => {
    capturedConfirm = dialog;
  });
  const setFocusedPaneId = vi.fn();

  const hookResult = renderHook(() => {
    const [state, setState] = useState<AppState>(initial);
    const activeWorkspace =
      state.workspaces.find((ws) => ws.id === state.activeWorkspaceId) ?? state.workspaces[0];
    const updateActiveWorkspace = (updater: (ws: Workspace) => Workspace) => {
      setState((current) => ({
        ...current,
        workspaces: current.workspaces.map((ws) =>
          ws.id === current.activeWorkspaceId ? updater(ws) : ws,
        ),
      }));
    };
    const actions = useProfileWorkspaceActions({
      state,
      setState,
      activeWorkspace,
      setFocusedPaneId,
      setConfirmDialog,
      openTextPrompt,
      updateActiveWorkspace,
    });
    return { state, actions };
  });

  return {
    get state() {
      return hookResult.result.current.state;
    },
    get actions() {
      return hookResult.result.current.actions;
    },
    setFocusedPaneId,
    setConfirmDialog,
    openTextPrompt,
    get capturedPrompt() {
      return capturedPrompt;
    },
    get capturedConfirm() {
      return capturedConfirm;
    },
  } as Harness;
}

describe("useProfileWorkspaceActions", () => {
  beforeEach(() => {
    invokeSpy.mockReset();
    tauriRuntime = false;
  });

  it("addBlankPaneWithProfile appends a blank pane bound to the profile", () => {
    const profile: Profile = { id: "prof-x", name: "X" };
    const initial = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-default")])],
      "ws1",
      [{ id: "prof-default", name: "Default" }, profile],
    );
    const h = setupHook(initial);

    act(() => h.actions.addBlankPaneWithProfile(profile));

    const panes = h.state.workspaces[0].panes;
    expect(panes).toHaveLength(2);
    expect(panes[1].profileId).toBe("prof-x");
    expect(panes[1].title).toBe("X");
  });

  it("addBlankPaneWithProfile uses 'Main Chat' title for the Default profile", () => {
    const defaultProfile: Profile = { id: "prof-default", name: "Default" };
    const initial = makeState(
      [makeWorkspace("ws1", [])],
      "ws1",
      [defaultProfile],
    );
    const h = setupHook(initial);

    act(() => h.actions.addBlankPaneWithProfile(defaultProfile));

    expect(h.state.workspaces[0].panes[0].title).toBe("Main Chat");
  });

  it("getProfileById returns matching profile or undefined", () => {
    const profiles = [
      { id: "prof-1", name: "P1" },
      { id: "prof-2", name: "P2" },
    ];
    const initial = makeState([makeWorkspace("ws1", [])], "ws1", profiles);
    const h = setupHook(initial);

    expect(h.actions.getProfileById("prof-2")?.name).toBe("P2");
    expect(h.actions.getProfileById("missing")).toBeUndefined();
  });

  it("ensureProfileWithName returns existing profile when name matches", () => {
    const profiles = [{ id: "prof-1", name: "Alice" }];
    const initial = makeState([makeWorkspace("ws1", [])], "ws1", profiles);
    const h = setupHook(initial);

    let returned!: Profile;
    act(() => {
      returned = h.actions.ensureProfileWithName("Alice");
    });
    expect(returned.id).toBe("prof-1");
    expect(h.state.profiles).toHaveLength(1);
  });

  it("ensureProfileWithName creates a new profile when name is unique", () => {
    const profiles = [{ id: "prof-1", name: "Alice" }];
    const initial = makeState([makeWorkspace("ws1", [])], "ws1", profiles);
    const h = setupHook(initial);

    let returned!: Profile;
    act(() => {
      returned = h.actions.ensureProfileWithName("Bob");
    });
    expect(returned.name).toBe("Bob");
    expect(h.state.profiles).toHaveLength(2);
  });

  it("ensureProfileWithName trims whitespace and falls back to 'Default' on empty input", () => {
    const profiles = [{ id: "prof-default", name: "Default" }];
    const initial = makeState([makeWorkspace("ws1", [])], "ws1", profiles);
    const h = setupHook(initial);

    let returned!: Profile;
    act(() => {
      returned = h.actions.ensureProfileWithName("   ");
    });
    expect(returned.id).toBe("prof-default");
  });

  it("renameProfile opens prompt and applies rename to profile + pane titles", () => {
    const profiles = [{ id: "prof-x", name: "X" }];
    const pane: ChatPane = { ...makePane("p1", "prof-x"), title: "P1" };
    const initial = makeState([makeWorkspace("ws1", [pane])], "ws1", profiles);
    const h = setupHook(initial);

    act(() => h.actions.renameProfile("prof-x"));
    expect(h.openTextPrompt).toHaveBeenCalledTimes(1);
    act(() => h.capturedPrompt!.onSubmit("Y"));

    expect(h.state.profiles[0].name).toBe("Y");
    expect(h.state.workspaces[0].panes[0].title).toBe("P1 — Y");
  });

  it("renameProfile no-op when same name submitted", () => {
    const profiles = [{ id: "prof-x", name: "X" }];
    const initial = makeState([makeWorkspace("ws1", [])], "ws1", profiles);
    const h = setupHook(initial);

    act(() => h.actions.renameProfile("prof-x"));
    act(() => h.capturedPrompt!.onSubmit("X"));

    expect(h.state.profiles[0].name).toBe("X");
  });

  it("renameProfile is a no-op when profile id does not exist", () => {
    const profiles = [{ id: "prof-default", name: "Default" }];
    const initial = makeState([makeWorkspace("ws1", [])], "ws1", profiles);
    const h = setupHook(initial);
    act(() => h.actions.renameProfile("missing-id"));
    expect(h.openTextPrompt).not.toHaveBeenCalled();
  });

  it("renameProfile renaming a profile to 'Default' strips the suffix from pane titles", () => {
    const profiles = [{ id: "prof-x", name: "X" }];
    const pane: ChatPane = { ...makePane("p1", "prof-x"), title: "P1 — X" };
    const initial = makeState([makeWorkspace("ws1", [pane])], "ws1", profiles);
    const h = setupHook(initial);

    act(() => h.actions.renameProfile("prof-x"));
    act(() => h.capturedPrompt!.onSubmit("Default"));

    expect(h.state.profiles[0].name).toBe("Default");
    // The base title (everything before " — ") should be retained without suffix.
    expect(h.state.workspaces[0].panes[0].title).toBe("P1");
  });

  it("renameProfile leaves panes bound to other profiles unchanged (line 103 early-return)", () => {
    const profiles = [
      { id: "prof-x", name: "X" },
      { id: "prof-y", name: "Y" },
    ];
    const paneX: ChatPane = { ...makePane("p1", "prof-x"), title: "P1 — X" };
    const paneY: ChatPane = { ...makePane("p2", "prof-y"), title: "P2 — Y" };
    const initial = makeState(
      [makeWorkspace("ws1", [paneX, paneY])],
      "ws1",
      profiles,
    );
    const h = setupHook(initial);
    act(() => h.actions.renameProfile("prof-x"));
    act(() => h.capturedPrompt!.onSubmit("Renamed"));
    expect(h.state.workspaces[0].panes[0].title).toBe("P1 — Renamed");
    // The pane bound to prof-y should be untouched (early-return branch).
    expect(h.state.workspaces[0].panes[1].title).toBe("P2 — Y");
  });

  it("deleteProfile shows in-use dialog when profile is bound to a pane", () => {
    const profiles = [{ id: "prof-x", name: "X" }];
    const initial = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-x")])],
      "ws1",
      profiles,
    );
    const h = setupHook(initial);

    act(() => h.actions.deleteProfile("prof-x"));

    expect(h.capturedConfirm?.title).toBe("Profile đang được dùng");
    expect(h.state.profiles).toHaveLength(1);
  });

  it("in-use dialog onConfirm is a no-op", () => {
    const profiles = [{ id: "prof-x", name: "X" }];
    const initial = makeState(
      [makeWorkspace("ws1", [makePane("p1", "prof-x")])],
      "ws1",
      profiles,
    );
    const h = setupHook(initial);
    act(() => h.actions.deleteProfile("prof-x"));
    expect(h.capturedConfirm).not.toBeNull();
    // Invoking the OK confirm handler must not throw or remove the profile.
    act(() => h.capturedConfirm!.onConfirm());
    expect(h.state.profiles).toHaveLength(1);
  });

  it("deleteProfile shows confirm dialog and removes profile on confirmation", () => {
    const profiles = [
      { id: "prof-default", name: "Default" },
      { id: "prof-x", name: "X" },
    ];
    const initial = makeState([makeWorkspace("ws1", [])], "ws1", profiles);
    const h = setupHook(initial);

    act(() => h.actions.deleteProfile("prof-x"));
    expect(h.capturedConfirm?.danger).toBe(true);

    act(() => h.capturedConfirm!.onConfirm());

    expect(h.state.profiles.map((p) => p.id)).toEqual(["prof-default"]);
  });

  it("deleteProfile is a no-op when profile id does not exist", () => {
    const profiles = [{ id: "prof-default", name: "Default" }];
    const initial = makeState([makeWorkspace("ws1", [])], "ws1", profiles);
    const h = setupHook(initial);
    act(() => h.actions.deleteProfile("missing-id"));
    expect(h.capturedConfirm).toBeNull();
    expect(h.state.profiles).toEqual(profiles);
  });

  it("deleteProfile invokes delete_profile_session in Tauri runtime", () => {
    tauriRuntime = true;
    invokeSpy.mockResolvedValue(undefined);
    const profiles = [
      { id: "prof-default", name: "Default" },
      { id: "prof@special", name: "Special" },
    ];
    const initial = makeState([makeWorkspace("ws1", [])], "ws1", profiles);
    const h = setupHook(initial);
    act(() => h.actions.deleteProfile("prof@special"));
    act(() => h.capturedConfirm!.onConfirm());
    expect(invokeSpy).toHaveBeenCalledWith("delete_profile_session", {
      profileId: "prof-special",
    });
    expect(h.state.profiles.map((p) => p.id)).toEqual(["prof-default"]);
  });

  it("logs and continues when delete_profile_session rejects in Tauri runtime", async () => {
    tauriRuntime = true;
    invokeSpy.mockRejectedValueOnce(new Error("native delete failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const profiles = [
      { id: "prof-default", name: "Default" },
      { id: "prof-x", name: "X" },
    ];
    const initial = makeState([makeWorkspace("ws1", [])], "ws1", profiles);
    const h = setupHook(initial);
    act(() => h.actions.deleteProfile("prof-x"));
    act(() => h.capturedConfirm!.onConfirm());
    // Profile is still removed from state synchronously even if invoke rejects.
    expect(h.state.profiles.map((p) => p.id)).toEqual(["prof-default"]);
    // Allow microtasks so the catch handler runs.
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(
      "delete_profile_session failed",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it("switchWorkspace changes activeWorkspaceId and clears focus", () => {
    const initial = makeState(
      [makeWorkspace("ws1", []), makeWorkspace("ws2", [])],
      "ws1",
      [{ id: "prof-default", name: "Default" }],
    );
    const h = setupHook(initial);

    act(() => h.actions.switchWorkspace("ws2"));

    expect(h.state.activeWorkspaceId).toBe("ws2");
    expect(h.setFocusedPaneId).toHaveBeenCalledWith(null);
  });

  it("switchWorkspace is a no-op when target is already active", () => {
    const initial = makeState(
      [makeWorkspace("ws1", [])],
      "ws1",
      [{ id: "prof-default", name: "Default" }],
    );
    const h = setupHook(initial);

    act(() => h.actions.switchWorkspace("ws1"));

    expect(h.setFocusedPaneId).not.toHaveBeenCalled();
  });

  it("createWorkspace adds a new workspace and switches to it", () => {
    const initial = makeState(
      [makeWorkspace("ws1", [])],
      "ws1",
      [{ id: "prof-default", name: "Default" }],
    );
    const h = setupHook(initial);

    act(() => h.actions.createWorkspace());

    expect(h.state.workspaces).toHaveLength(2);
    expect(h.state.activeWorkspaceId).toBe(h.state.workspaces[1].id);
    expect(h.setFocusedPaneId).toHaveBeenCalledWith(null);
  });

  it("renameActiveWorkspace prompts and updates the active workspace name", () => {
    const initial = makeState(
      [makeWorkspace("ws1", [])],
      "ws1",
      [{ id: "prof-default", name: "Default" }],
    );
    const h = setupHook(initial);

    act(() => h.actions.renameActiveWorkspace());
    act(() => h.capturedPrompt!.onSubmit("Renamed"));

    expect(h.state.workspaces[0].name).toBe("Renamed");
  });

  it("renameActiveWorkspace is a no-op when submitted name equals current name", () => {
    const ws = makeWorkspace("ws1", []);
    ws.name = "Same";
    const initial = makeState([ws], "ws1", [{ id: "prof-default", name: "Default" }]);
    const h = setupHook(initial);
    act(() => h.actions.renameActiveWorkspace());
    act(() => h.capturedPrompt!.onSubmit("Same"));
    // Workspace state should be the original (no rename applied).
    expect(h.state.workspaces[0].name).toBe("Same");
  });

  it("deleteActiveWorkspace is a no-op when only one workspace remains", () => {
    const initial = makeState(
      [makeWorkspace("ws1", [])],
      "ws1",
      [{ id: "prof-default", name: "Default" }],
    );
    const h = setupHook(initial);

    act(() => h.actions.deleteActiveWorkspace());

    expect(h.setConfirmDialog).not.toHaveBeenCalled();
    expect(h.state.workspaces).toHaveLength(1);
  });

  it("deleteActiveWorkspace shows confirm and removes workspace on confirmation", () => {
    const initial = makeState(
      [makeWorkspace("ws1", []), makeWorkspace("ws2", [])],
      "ws1",
      [{ id: "prof-default", name: "Default" }],
    );
    const h = setupHook(initial);

    act(() => h.actions.deleteActiveWorkspace());
    expect(h.capturedConfirm?.danger).toBe(true);

    act(() => h.capturedConfirm!.onConfirm());

    expect(h.state.workspaces.map((w) => w.id)).toEqual(["ws2"]);
    expect(h.state.activeWorkspaceId).toBe("ws2");
  });
});
