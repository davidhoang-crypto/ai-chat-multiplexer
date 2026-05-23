import { IconCheck, IconChevronDown, IconEdit, IconPlus, IconTrash } from "../Icons";
import type { Workspace } from "../appCore";

type Props = {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activePaneCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
};

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  activePaneCount,
  open,
  onOpenChange,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const active = workspaces.find((ws) => ws.id === activeWorkspaceId) ?? workspaces[0];

  return (
    <details
      className="workspace-switcher"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary aria-label="Chọn workspace">
        <span className="workspace-name">{active.name}</span>
        <span className="workspace-pane-count">
          · {activePaneCount} {activePaneCount === 1 ? "pane" : "panes"}
        </span>
        <IconChevronDown size={12} className="caret" />
      </summary>
      <div className="preset-menu workspace-menu" role="menu" aria-label="Danh sách workspace">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            type="button"
            className={ws.id === activeWorkspaceId ? "workspace-item active" : "workspace-item"}
            onClick={() => {
              onSwitch(ws.id);
              onOpenChange(false);
            }}
            role="menuitem"
          >
            <span className="workspace-dot" aria-hidden="true">
              {ws.id === activeWorkspaceId ? <IconCheck size={12} /> : null}
            </span>
            <span>{ws.name}</span>
            <span className="workspace-meta">{ws.panes.length}</span>
          </button>
        ))}
        <div className="menu-separator" role="separator" />
        <button
          type="button"
          className="workspace-item"
          onClick={() => {
            onCreate();
            onOpenChange(false);
          }}
          role="menuitem"
        >
          <span className="workspace-dot" aria-hidden="true">
            <IconPlus size={12} />
          </span>
          <span>New workspace</span>
        </button>
        <button
          type="button"
          className="workspace-item"
          onClick={() => {
            onOpenChange(false);
            onRename();
          }}
          role="menuitem"
        >
          <span className="workspace-dot" aria-hidden="true">
            <IconEdit size={12} />
          </span>
          <span>Rename current</span>
        </button>
        <button
          type="button"
          className="workspace-item danger-menu-item"
          onClick={() => {
            onOpenChange(false);
            onDelete();
          }}
          disabled={workspaces.length <= 1}
          role="menuitem"
        >
          <span className="workspace-dot" aria-hidden="true">
            <IconTrash size={12} />
          </span>
          <span>Delete current</span>
        </button>
      </div>
    </details>
  );
}
