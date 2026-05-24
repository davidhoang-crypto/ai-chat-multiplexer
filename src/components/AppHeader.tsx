import {
  AppLogo,
  AppWordmark,
  IconDownload,
  IconEdit,
  IconPlus,
  IconSettings,
  IconTrash,
} from "../Icons";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import type { AppState, Profile, Workspace } from "../appCore";

export interface AppHeaderProps {
  state: AppState;
  activeWorkspace: Workspace;
  activePaneCount: number;

  // Workspace switcher
  isWorkspaceMenuOpen: boolean;
  setIsWorkspaceMenuOpen: (open: boolean) => void;
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: () => void;
  renameActiveWorkspace: () => void;
  deleteActiveWorkspace: () => void;

  // Layout
  setColumns: (columns: number) => void;

  // New pane menu
  isNewPaneMenuOpen: boolean;
  setIsNewPaneMenuOpen: (open: boolean) => void;
  addBlankPaneWithProfile: (profile: Profile) => void;
  renameProfile: (profileId: string) => void;
  deleteProfile: (profileId: string) => void;
  openTextPrompt: (opts: {
    title: string;
    initial?: string;
    placeholder?: string;
    onSubmit: (value: string) => void;
  }) => void;
  ensureProfileWithName: (profileName: string) => Profile;

  // Downloads + settings
  hasActiveDownload: boolean;
  setIsDownloadsOpen: (updater: (open: boolean) => boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
}

export function AppHeader({
  state,
  activeWorkspace,
  activePaneCount,
  isWorkspaceMenuOpen,
  setIsWorkspaceMenuOpen,
  switchWorkspace,
  createWorkspace,
  renameActiveWorkspace,
  deleteActiveWorkspace,
  setColumns,
  isNewPaneMenuOpen,
  setIsNewPaneMenuOpen,
  addBlankPaneWithProfile,
  renameProfile,
  deleteProfile,
  openTextPrompt,
  ensureProfileWithName,
  hasActiveDownload,
  setIsDownloadsOpen,
  setIsSettingsOpen,
}: AppHeaderProps) {
  return (
    <header className="terminal-topbar">
      <section className="brand">
        <div className="brand-badge" aria-label="AI Multiplexer">
          <span className="brand-mark" aria-hidden="true">
            <AppLogo size={26} />
          </span>
          <AppWordmark height={20} className="brand-wordmark" />
          <span className="brand-shimmer" aria-hidden="true" />
        </div>
      </section>

      <section className="workspace-center">
        <WorkspaceSwitcher
          workspaces={state.workspaces}
          activeWorkspaceId={state.activeWorkspaceId}
          activePaneCount={activePaneCount}
          open={isWorkspaceMenuOpen}
          onOpenChange={setIsWorkspaceMenuOpen}
          onSwitch={switchWorkspace}
          onCreate={createWorkspace}
          onRename={renameActiveWorkspace}
          onDelete={deleteActiveWorkspace}
        />
      </section>

      <section className="toolbar" aria-label="Điều khiển layout">
        <div className="layout-segment" aria-label="Chọn bố cục">
          {[
            { value: 1, label: "Focus" },
            { value: 2, label: "2" },
            { value: 3, label: "3" },
            { value: 4, label: "4" },
          ].map((item) => {
            const isActiveLayout = activeWorkspace.columns === item.value;

            return (
              <button
                key={item.value}
                type="button"
                className={isActiveLayout ? "segment active" : "segment"}
                onClick={() => setColumns(item.value)}
                aria-label={`Use ${item.label} column layout`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <details
          className="new-pane-menu"
          open={isNewPaneMenuOpen}
          onToggle={(event) => setIsNewPaneMenuOpen(event.currentTarget.open)}
        >
          <summary>New pane</summary>
          <div className="preset-menu profile-menu" aria-label="Chọn profile cho pane mới">
            {state.profiles.map((profile) => (
              <div className="profile-row" key={profile.id} role="none">
                <button
                  type="button"
                  className="profile-pick"
                  onClick={() => {
                    addBlankPaneWithProfile(profile);
                    setIsNewPaneMenuOpen(false);
                  }}
                >
                  <span className="profile-dot" aria-hidden="true">●</span>
                  <span className="profile-pick-name">{profile.name}</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    renameProfile(profile.id);
                  }}
                  aria-label={`Đổi tên ${profile.name}`}
                  title="Đổi tên"
                >
                  <IconEdit size={11} />
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteProfile(profile.id);
                  }}
                  aria-label={`Xóa ${profile.name}`}
                  title="Xóa profile"
                >
                  <IconTrash size={11} />
                </button>
              </div>
            ))}
            <div className="menu-separator" role="separator" />
            <button
              type="button"
              className="profile-pick profile-create"
              onClick={() => {
                setIsNewPaneMenuOpen(false);
                openTextPrompt({
                  title: "Profile mới",
                  initial: "",
                  placeholder: "vd: Work, Personal",
                  onSubmit: (name) => {
                    const profile = ensureProfileWithName(name);
                    addBlankPaneWithProfile(profile);
                  },
                });
              }}
            >
              <span className="profile-dot" aria-hidden="true">
                <IconPlus size={11} />
              </span>
              <span>New profile…</span>
            </button>
          </div>
        </details>
        <button
          type="button"
          className="theme-toggle downloads-button"
          onClick={() => setIsDownloadsOpen((open) => !open)}
          aria-label="Tải xuống"
          title="Tải xuống"
        >
          <IconDownload size={14} />
          {hasActiveDownload && <span className="downloads-button-dot" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Mở cài đặt"
          title="Settings"
        >
          <IconSettings size={14} />
        </button>
      </section>
    </header>
  );
}
