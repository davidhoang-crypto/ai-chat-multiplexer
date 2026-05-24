import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// --- Hook mocks: keep the App composition tests independent of the real hook
// implementations (which touch Tauri, persistence, side-effects, etc.). Each
// mock returns a stable, minimal object that exercises the wiring in App.

vi.mock("./hooks/useAppPersistence", () => ({
  useAppPersistence: () => ({
    state: {
      workspaces: [
        {
          id: "ws-1",
          name: "Default",
          columns: 2,
          panes: [],
        },
      ],
      activeWorkspaceId: "ws-1",
      profiles: [{ id: "prof-default", name: "Default" }],
    },
    setState: vi.fn(),
    theme: "light" as const,
    setTheme: vi.fn(),
  }),
}));

vi.mock("./hooks/useDragState", () => ({
  useDragState: () => ({
    draggingPaneId: null,
    setDraggingPaneId: vi.fn(),
    dragOverPaneId: null,
    setDragOverPaneId: vi.fn(),
    editingUrls: {},
    setEditingUrls: vi.fn(),
    tabDragOver: null,
    setTabDragOver: vi.fn(),
    draggingTabKey: null,
    setDraggingTabKey: vi.fn(),
    webviewShells: { current: {} },
    paneDrag: { current: null },
    tabDrag: { current: null },
  }),
}));

vi.mock("./hooks/useDerivedWorkspaceState", () => ({
  useDerivedWorkspaceState: () => ({
    activeWorkspace: {
      id: "ws-1",
      name: "Default",
      columns: 2,
      panes: [],
    },
    activePanes: [],
    visiblePanes: [],
    effectiveColumns: 2,
    shouldSuspendNativeWebviews: false,
  }),
}));

vi.mock("./hooks/useFocusedPaneCleanup", () => ({
  useFocusedPaneCleanup: vi.fn(),
}));

const setIsNewPaneMenuOpen = vi.fn();
const setIsWorkspaceMenuOpen = vi.fn();
const setIsDownloadsOpen = vi.fn();
const setIsSettingsOpen = vi.fn();

vi.mock("./hooks/useMenuStates", () => ({
  useMenuStates: () => ({
    isNewPaneMenuOpen: false,
    setIsNewPaneMenuOpen,
    isWorkspaceMenuOpen: false,
    setIsWorkspaceMenuOpen,
    isDownloadsOpen: false,
    setIsDownloadsOpen,
    isSettingsOpen: false,
    setIsSettingsOpen,
  }),
}));

const dismissToast = vi.fn();
const openFile = vi.fn();
const revealFolder = vi.fn();
const clearAll = vi.fn();

vi.mock("./hooks/useDownloadManager", () => ({
  useDownloadManager: () => ({
    toasts: [],
    hasActiveDownload: false,
    dismissToast,
    openFile,
    revealFolder,
    clearAll,
  }),
}));

vi.mock("./hooks/useNativeWebviews", () => ({
  useNativeWebviews: vi.fn(),
}));

vi.mock("./hooks/useBackupAndUpdates", () => ({
  useBackupAndUpdates: () => ({
    updateStatus: { kind: "idle" },
    backupBusy: "idle",
    checkForUpdates: vi.fn(),
    openReleasePage: vi.fn(),
    exportConfigJson: vi.fn(),
    importConfigJson: vi.fn(),
    exportFullBackup: vi.fn(),
    restoreFullBackup: vi.fn(),
  }),
}));

vi.mock("./hooks/useNativeTabStatus", () => ({
  useNativeTabStatus: vi.fn(),
}));

vi.mock("./hooks/usePaneActions", () => ({
  usePaneActions: () => ({
    updateActiveWorkspace: vi.fn(),
    updateActivePane: vi.fn(),
    setColumns: vi.fn(),
    removePane: vi.fn(),
    addTab: vi.fn(),
    removeTab: vi.fn(),
    startEditingUrl: vi.fn(),
    updateEditingUrl: vi.fn(),
    commitTabUrl: vi.fn(),
    navigateActiveWebview: vi.fn(),
    moveTabWithinPane: vi.fn(),
    moveTabAcrossPanes: vi.fn(),
    detachTabToNewPane: vi.fn(),
    finishPaneDrag: vi.fn(),
  }),
}));

vi.mock("./hooks/usePromptDialogs", () => ({
  usePromptDialogs: () => ({
    textPrompt: null,
    textPromptValue: "",
    setTextPromptValue: vi.fn(),
    confirmDialog: null,
    setConfirmDialog: vi.fn(),
    openTextPrompt: vi.fn(),
    closeTextPrompt: vi.fn(),
    submitTextPrompt: vi.fn(),
  }),
}));

vi.mock("./hooks/useProfileWorkspaceActions", () => ({
  useProfileWorkspaceActions: () => ({
    addBlankPaneWithProfile: vi.fn(),
    getProfileById: () => ({ id: "prof-default", name: "Default" }),
    ensureProfileWithName: vi.fn(),
    renameProfile: vi.fn(),
    deleteProfile: vi.fn(),
    switchWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
    renameActiveWorkspace: vi.fn(),
    deleteActiveWorkspace: vi.fn(),
  }),
}));

// Stub child components so we only verify App's wiring of them.
const appHeaderProps = vi.fn();
const paneGridProps = vi.fn();
const appOverlaysProps = vi.fn();

vi.mock("./components/AppHeader", () => ({
  AppHeader: (props: unknown) => {
    appHeaderProps(props);
    return <div data-testid="app-header" />;
  },
}));
vi.mock("./components/PaneGrid", () => ({
  PaneGrid: (props: unknown) => {
    paneGridProps(props);
    return <div data-testid="pane-grid" />;
  },
}));
vi.mock("./components/AppOverlays", () => ({
  AppOverlays: (props: unknown) => {
    appOverlaysProps(props);
    return <div data-testid="app-overlays" />;
  },
}));

import App from "./App";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  it("renders header, pane grid, and overlays inside a themed shell", () => {
    const { container, getByTestId } = render(<App />);
    expect(getByTestId("app-header")).toBeDefined();
    expect(getByTestId("pane-grid")).toBeDefined();
    expect(getByTestId("app-overlays")).toBeDefined();

    const shell = container.querySelector("main.app-shell")!;
    expect(shell).not.toBeNull();
    expect(shell.className).toContain("theme-light");
  });

  it("forwards key state and actions to AppHeader", () => {
    render(<App />);
    expect(appHeaderProps).toHaveBeenCalled();
    const props = appHeaderProps.mock.calls[0][0] as Record<string, unknown>;
    expect((props.activeWorkspace as { id: string }).id).toBe("ws-1");
    expect(props.activePaneCount).toBe(0);
    expect(props.hasActiveDownload).toBe(false);
    expect(typeof props.setColumns).toBe("function");
    expect(typeof props.addBlankPaneWithProfile).toBe("function");
    expect(typeof props.openTextPrompt).toBe("function");
    expect(props.setIsDownloadsOpen).toBe(setIsDownloadsOpen);
    expect(props.setIsSettingsOpen).toBe(setIsSettingsOpen);
  });

  it("forwards derived workspace data and refs to PaneGrid", () => {
    render(<App />);
    expect(paneGridProps).toHaveBeenCalled();
    const props = paneGridProps.mock.calls[0][0] as Record<string, unknown>;
    expect(props.visiblePanes).toEqual([]);
    expect(props.activePanes).toEqual([]);
    expect(props.effectiveColumns).toBe(2);
    expect(props.focusedPaneId).toBeNull();
    expect(typeof props.getProfileById).toBe("function");
    expect(typeof props.addTab).toBe("function");
    expect(typeof props.finishPaneDrag).toBe("function");
  });

  it("forwards prompt, settings, and download wiring to AppOverlays", () => {
    render(<App />);
    expect(appOverlaysProps).toHaveBeenCalled();
    const props = appOverlaysProps.mock.calls[0][0] as Record<string, unknown>;
    expect(props.textPrompt).toBeNull();
    expect(props.confirmDialog).toBeNull();
    expect(props.isSettingsOpen).toBe(false);
    expect(props.isDownloadsOpen).toBe(false);
    expect(props.theme).toBe("light");
    expect(props.downloadToasts).toEqual([]);
    expect(props.dismissToast).toBe(dismissToast);
    expect(props.openFile).toBe(openFile);
    expect(props.revealFolder).toBe(revealFolder);
    expect(props.clearAll).toBe(clearAll);
  });
});
