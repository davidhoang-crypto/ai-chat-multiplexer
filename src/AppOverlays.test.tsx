import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("./appCore", async () => {
  const actual = await vi.importActual<typeof import("./appCore")>("./appCore");
  return {
    ...actual,
    isTauriRuntime: () => false,
  };
});

import { AppOverlays, type AppOverlaysProps } from "./components/AppOverlays";
import type { DownloadToast } from "./appCore";

afterEach(cleanup);

function defaultProps(overrides: Partial<AppOverlaysProps> = {}): AppOverlaysProps {
  return {
    textPrompt: null,
    textPromptValue: "",
    setTextPromptValue: vi.fn(),
    closeTextPrompt: vi.fn(),
    submitTextPrompt: vi.fn(),
    confirmDialog: null,
    setConfirmDialog: vi.fn(),
    isSettingsOpen: false,
    setIsSettingsOpen: vi.fn(),
    theme: "light",
    setTheme: vi.fn(),
    updateStatus: { kind: "idle" },
    checkForUpdates: vi.fn(),
    openReleasePage: vi.fn(),
    backupBusy: "idle",
    exportConfigJson: vi.fn(),
    importConfigJson: vi.fn(),
    exportFullBackup: vi.fn(),
    restoreFullBackup: vi.fn(),
    isDownloadsOpen: false,
    setIsDownloadsOpen: vi.fn(),
    downloadToasts: [],
    dismissToast: vi.fn(),
    openFile: vi.fn(),
    revealFolder: vi.fn(),
    clearAll: vi.fn(),
    ...overrides,
  };
}

function makeToast(overrides: Partial<DownloadToast> = {}): DownloadToast {
  return {
    id: "d1",
    status: "downloading",
    fileName: "file.zip",
    path: null,
    createdAt: 1,
    ...overrides,
  };
}

describe("AppOverlays", () => {
  it("renders no overlays when nothing is open", () => {
    const { container } = render(<AppOverlays {...defaultProps()} />);
    expect(container.querySelector(".modal-backdrop")).toBeNull();
    expect(container.querySelector(".downloads-panel")).toBeNull();
    expect(container.querySelector(".download-toast-stack")).toBeNull();
  });

  it("renders TextPromptModal when textPrompt is set", () => {
    render(
      <AppOverlays
        {...defaultProps({
          textPrompt: { title: "Đổi tên", initial: "", onSubmit: () => undefined },
        })}
      />,
    );
    expect(screen.getByText("Đổi tên")).toBeDefined();
  });

  it("renders ConfirmDialog when confirmDialog is set and routes onClose to setConfirmDialog(null)", () => {
    const props = defaultProps({
      confirmDialog: { title: "X?", message: "M", onConfirm: () => undefined },
    });
    render(<AppOverlays {...props} />);
    expect(screen.getByText("X?")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(props.setConfirmDialog).toHaveBeenCalledWith(null);
  });

  it("renders SettingsModal when isSettingsOpen and routes close to setIsSettingsOpen(false)", () => {
    const props = defaultProps({ isSettingsOpen: true });
    render(<AppOverlays {...props} />);
    expect(screen.getByText("Settings")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(props.setIsSettingsOpen).toHaveBeenCalledWith(false);
  });

  it("renders DownloadToastStack when toasts are present", () => {
    render(
      <AppOverlays {...defaultProps({ downloadToasts: [makeToast()] })} />,
    );
    expect(screen.getByText("Đang tải…")).toBeDefined();
  });

  it("renders DownloadsPanel when isDownloadsOpen and routes close to setIsDownloadsOpen(false)", () => {
    const props = defaultProps({ isDownloadsOpen: true, downloadToasts: [makeToast()] });
    render(<AppOverlays {...props} />);
    const panel = document.querySelector(".downloads-panel")!;
    expect(panel).not.toBeNull();
    fireEvent.click(panel.querySelector('button[aria-label="Đóng"]')!);
    expect(props.setIsDownloadsOpen).toHaveBeenCalledWith(false);
  });

  it("DownloadsPanel 'Mở' button forwards path to openFile (line 117 arrow)", () => {
    const successToast = makeToast({
      status: "success",
      path: "C:/dl/keep.zip",
      fileName: "keep.zip",
    });
    const props = defaultProps({
      isDownloadsOpen: true,
      downloadToasts: [successToast],
    });
    render(<AppOverlays {...props} />);
    const panel = document.querySelector(".downloads-panel")!;
    // Find the "Mở file" button rendered inside the panel specifically (the
    // DownloadToastStack also renders a sibling "Mở file" button outside it).
    const buttons = Array.from(panel.querySelectorAll("button"));
    const openFileBtn = buttons.find(
      (btn) => btn.textContent?.trim() === "Mở file",
    ) as HTMLButtonElement | undefined;
    expect(openFileBtn).toBeDefined();
    fireEvent.click(openFileBtn!);
    expect(props.openFile).toHaveBeenCalledWith("C:/dl/keep.zip");
  });

  it("DownloadToastStack 'Mở file' / 'Mở folder' route to openFile and revealFolder", () => {
    const successToast = makeToast({
      status: "success",
      path: "C:/dl/x.zip",
      fileName: "x.zip",
    });
    const props = defaultProps({ downloadToasts: [successToast] });
    render(<AppOverlays {...props} />);
    fireEvent.click(screen.getAllByText("Mở file")[0]);
    expect(props.openFile).toHaveBeenCalledWith("C:/dl/x.zip");
    fireEvent.click(screen.getAllByText("Mở folder")[0]);
    expect(props.revealFolder).toHaveBeenCalledWith("C:/dl/x.zip");
  });
});
