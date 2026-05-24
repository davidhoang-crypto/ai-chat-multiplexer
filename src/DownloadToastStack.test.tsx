import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { DownloadToastStack } from "./components/DownloadToastStack";
import type { DownloadToast } from "./appCore";

afterEach(cleanup);

function makeToast(overrides: Partial<DownloadToast> = {}): DownloadToast {
  return {
    id: "d1",
    status: "downloading",
    fileName: "file.zip",
    path: null,
    createdAt: 1000,
    ...overrides,
  };
}

function defaultProps(overrides: Partial<React.ComponentProps<typeof DownloadToastStack>> = {}) {
  return {
    toasts: [],
    onDismiss: vi.fn(),
    onOpenFile: vi.fn(),
    onRevealFolder: vi.fn(),
    ...overrides,
  };
}

describe("DownloadToastStack", () => {
  it("renders nothing when toasts list is empty", () => {
    const { container } = render(<DownloadToastStack {...defaultProps()} />);
    expect(container.children).toHaveLength(0);
  });

  it("renders 'Đang tải…' for downloading toasts", () => {
    render(
      <DownloadToastStack
        {...defaultProps({ toasts: [makeToast({ status: "downloading" })] })}
      />,
    );
    expect(screen.getByText("Đang tải…")).toBeDefined();
  });

  it("renders 'Đã tải xong' for success toasts and shows action buttons", () => {
    const props = defaultProps({
      toasts: [makeToast({ status: "success", path: "C:/d/file.zip" })],
    });
    render(<DownloadToastStack {...props} />);
    expect(screen.getByText("Đã tải xong")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Mở file" }));
    expect(props.onOpenFile).toHaveBeenCalledWith("C:/d/file.zip");
    fireEvent.click(screen.getByRole("button", { name: "Mở folder" }));
    expect(props.onRevealFolder).toHaveBeenCalledWith("C:/d/file.zip");
  });

  it("renders 'Tải lỗi' for error toasts", () => {
    render(
      <DownloadToastStack
        {...defaultProps({ toasts: [makeToast({ status: "error" })] })}
      />,
    );
    expect(screen.getByText("Tải lỗi")).toBeDefined();
  });

  it("does not render action buttons when success toast lacks path", () => {
    render(
      <DownloadToastStack
        {...defaultProps({ toasts: [makeToast({ status: "success", path: null })] })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Mở file" })).toBeNull();
  });

  it("calls onDismiss when close button is clicked", () => {
    const props = defaultProps({ toasts: [makeToast({ id: "abc" })] });
    render(<DownloadToastStack {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(props.onDismiss).toHaveBeenCalledWith("abc");
  });

  it("renders multiple toasts in order", () => {
    const toasts = [
      makeToast({ id: "a", fileName: "first.zip" }),
      makeToast({ id: "b", fileName: "second.zip" }),
    ];
    const { container } = render(<DownloadToastStack {...defaultProps({ toasts })} />);
    const names = Array.from(container.querySelectorAll(".download-toast-name")).map(
      (el) => el.textContent,
    );
    expect(names).toEqual(["first.zip", "second.zip"]);
  });
});
