import { invoke } from "@tauri-apps/api/core";
import {
  createDefaultWorkspace,
  createId,
  isTauriRuntime,
  type AppState,
  type ChatPane,
  type Profile,
  type Workspace,
} from "../appCore";
import { getNewTabUrl, NEW_TAB_TITLE } from "../newtab";
import type { ConfirmDialogOptions, TextPromptOptions } from "../types/dialogs";

export interface UseProfileWorkspaceActionsArgs {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  activeWorkspace: Workspace;
  setFocusedPaneId: (id: string | null) => void;
  setConfirmDialog: (dialog: ConfirmDialogOptions | null) => void;
  openTextPrompt: (opts: TextPromptOptions) => void;
  updateActiveWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
}

export interface ProfileWorkspaceActions {
  addBlankPaneWithProfile: (profile: Profile) => void;
  getProfileById: (profileId: string) => Profile | undefined;
  ensureProfileWithName: (profileName: string) => Profile;
  renameProfile: (profileId: string) => void;
  deleteProfile: (profileId: string) => void;
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: () => void;
  renameActiveWorkspace: () => void;
  deleteActiveWorkspace: () => void;
}

export function useProfileWorkspaceActions({
  state,
  setState,
  activeWorkspace,
  setFocusedPaneId,
  setConfirmDialog,
  openTextPrompt,
  updateActiveWorkspace,
}: UseProfileWorkspaceActionsArgs): ProfileWorkspaceActions {
  function addBlankPaneWithProfile(profile: Profile) {
    const paneId = createId("pane");
    const tabId = createId("tab");
    const newTabUrl = getNewTabUrl();
    const paneTitle = profile.name === "Default" ? "Main Chat" : profile.name;
    const newPane: ChatPane = {
      id: paneId,
      title: paneTitle,
      profileId: profile.id,
      activeTabId: tabId,
      tabs: [
        {
          id: tabId,
          title: NEW_TAB_TITLE,
          url: newTabUrl,
          loadedUrl: newTabUrl,
          currentUrl: newTabUrl,
        },
      ],
    };
    updateActiveWorkspace((workspace) => ({
      ...workspace,
      panes: [...workspace.panes, newPane],
    }));
  }

  function getProfileById(profileId: string): Profile | undefined {
    return state.profiles.find((p) => p.id === profileId);
  }

  function ensureProfileWithName(profileName: string): Profile {
    const trimmed = profileName.trim() || "Default";
    const existing = state.profiles.find((p) => p.name === trimmed);
    if (existing) return existing;

    const newProfile: Profile = {
      id: createId("prof"),
      name: trimmed,
    };
    setState((current) => ({ ...current, profiles: [...current.profiles, newProfile] }));
    return newProfile;
  }

  function renameProfile(profileId: string) {
    const profile = state.profiles.find((p) => p.id === profileId);
    if (!profile) return;
    openTextPrompt({
      title: `Đổi tên profile`,
      initial: profile.name,
      placeholder: "Tên mới",
      onSubmit: (next) => {
        if (next === profile.name) return;
        setState((current) => ({
          ...current,
          profiles: current.profiles.map((p) => (p.id === profileId ? { ...p, name: next } : p)),
          workspaces: current.workspaces.map((ws) => ({
            ...ws,
            panes: ws.panes.map((pane) => {
              if (pane.profileId !== profileId) return pane;
              const baseTitle = pane.title.split(" — ")[0];
              return {
                ...pane,
                title: next === "Default" ? baseTitle : `${baseTitle} — ${next}`,
              };
            }),
          })),
        }));
      },
    });
  }

  function deleteProfile(profileId: string) {
    const profile = state.profiles.find((p) => p.id === profileId);
    if (!profile) return;

    const inUse = state.workspaces.some((ws) =>
      ws.panes.some((pane) => pane.profileId === profileId),
    );
    if (inUse) {
      setConfirmDialog({
        title: "Profile đang được dùng",
        message: "Profile này đang được dùng bởi một pane đang mở. Đóng pane trước khi xóa.",
        confirmLabel: "OK",
        onConfirm: () => undefined,
      });
      return;
    }

    setConfirmDialog({
      title: `Xóa profile "${profile.name}"?`,
      message: "Toàn bộ cookie và đăng nhập của profile này sẽ bị xóa vĩnh viễn.",
      confirmLabel: "Xóa",
      danger: true,
      onConfirm: () => {
        if (isTauriRuntime()) {
          void invoke("delete_profile_session", {
            profileId: profileId.replace(/[^a-zA-Z0-9_-]/g, "-"),
          }).catch((error) => console.error("delete_profile_session failed", error));
        }
        setState((current) => ({
          ...current,
          profiles: current.profiles.filter((p) => p.id !== profileId),
        }));
      },
    });
  }

  function switchWorkspace(workspaceId: string) {
    if (workspaceId === state.activeWorkspaceId) return;
    setFocusedPaneId(null);
    setState((current) => ({ ...current, activeWorkspaceId: workspaceId }));
  }

  function createWorkspace() {
    const nextIndex = state.workspaces.length + 1;
    const workspace = createDefaultWorkspace(`Workspace ${nextIndex}`);
    setFocusedPaneId(null);
    setState((current) => ({
      ...current,
      workspaces: [...current.workspaces, workspace],
      activeWorkspaceId: workspace.id,
    }));
  }

  function renameActiveWorkspace() {
    const currentName = activeWorkspace.name;
    openTextPrompt({
      title: "Đổi tên workspace",
      initial: currentName,
      placeholder: "Tên mới",
      onSubmit: (next) => {
        if (next === currentName) return;
        updateActiveWorkspace((workspace) => ({ ...workspace, name: next }));
      },
    });
  }

  function deleteActiveWorkspace() {
    if (state.workspaces.length <= 1) return;

    setConfirmDialog({
      title: `Xóa workspace "${activeWorkspace.name}"?`,
      message: "Tất cả pane bên trong sẽ bị đóng. Profile và session vẫn được giữ lại.",
      confirmLabel: "Xóa",
      danger: true,
      onConfirm: () => {
        setFocusedPaneId(null);
        setState((current) => {
          const remaining = current.workspaces.filter(
            (ws) => ws.id !== current.activeWorkspaceId,
          );
          return {
            ...current,
            workspaces: remaining,
            activeWorkspaceId: remaining[0].id,
          };
        });
      },
    });
  }

  return {
    addBlankPaneWithProfile,
    getProfileById,
    ensureProfileWithName,
    renameProfile,
    deleteProfile,
    switchWorkspace,
    createWorkspace,
    renameActiveWorkspace,
    deleteActiveWorkspace,
  };
}
