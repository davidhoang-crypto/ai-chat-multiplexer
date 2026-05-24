import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { DownloadsPanel } from "./components/DownloadsPanel";
import type { DownloadToast } from "./appCore";

afterEach(cleanup);

function makeItem(overrides: Partial<DownloadToast> = {}): DownloadToast {
  return {
    id: "d1",
    status: "downloading",
    fileName: "file.zip",
    path: null,
    createdAt: 1000,
    ...overrides,
  };
}

function defaultProps(overrides: Partial<React.ComponentProps<typeof DownloadsPanel>> = {}) {
  return {
    open: true,
    items: [],
    onClose: vi.fn(),
    onClearAll: vi.fn(),
    onOpenFile: vi.fn(),
    onRevealFolder: vi.fn(),
    ...overrides,
  };
}

describe("DownloadsPanel", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <DownloadsPanel {...defaultProps({ open: false })} />,
    );
    expect(container.children).toHaveLength(0);
  });

  it("shows empty state when items list is empty", () => {
    render(<DownloadsPanel {...defaultProps()} />);
    expect(screen.getByText("Chưa có file nào được tải.")).toBeDefined();
  });

  it("hides 'Xóa hết' button when items list is empty", () => {
    render(<DownloadsPanel {...defaultProps()} />);
    expect(screen.queryByRole("button", { name: "Xóa hết" })).toBeNull();
  });

  it("shows 'Xóa hết' button and calls onClearAll when clicked", () => {
    const props = defaultProps({ items: [makeItem()] });
    render(<DownloadsPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Xóa hết" }));
    expect(props.onClearAll).toHaveBeenCalled();
  });

  it("calls onClose when close icon is clicked", () => {
    const props = defaultProps();
    render(<DownloadsPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("renders downloading status text", () => {
    render(
      <DownloadsPanel
        {...defaultProps({ items: [makeItem({ status: "downloading" })] })}
      />,
    );
    expect(screen.getByText("Đang tải…")).toBeDefined();
  });

  it("renders success status with action buttons when path is set", () => {
    const props = defaultProps({
      items: [makeItem({ status: "success", path: "C:/dl/file.zip" })],
    });
    render(<DownloadsPanel {...props} />);
    expect(screen.getByText("Hoàn tất")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Mở file" }));
    expect(props.onOpenFile).toHaveBeenCalledWith("C:/dl/file.zip");
    fireEvent.click(screen.getByRole("button", { name: "Mở folder" }));
    expect(props.onRevealFolder).toHaveBeenCalledWith("C:/dl/file.zip");
  });

  it("does not render action buttons for success when path is null", () => {
    render(
      <DownloadsPanel
        {...defaultProps({ items: [makeItem({ status: "success", path: null })] })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Mở file" })).toBeNull();
  });

  it("renders error status text", () => {
    render(
      <DownloadsPanel
        {...defaultProps({ items: [makeItem({ status: "error" })] })}
      />,
    );
    expect(screen.getByText("Lỗi")).toBeDefined();
  });

  it("renders cancelled status text", () => {
    render(
      <DownloadsPanel
        {...defaultProps({ items: [makeItem({ status: "cancelled" })] })}
      />,
    );
    expect(screen.getByText("Đã hủy")).toBeDefined();
  });

  it("sorts items by createdAt descending (newest first)", () => {
    const items = [
      makeItem({ id: "a", fileName: "old.zip", createdAt: 100 }),
      makeItem({ id: "b", fileName: "new.zip", createdAt: 500 }),
      makeItem({ id: "c", fileName: "mid.zip", createdAt: 300 }),
    ];
    const { container } = render(<DownloadsPanel {...defaultProps({ items })} />);
    const names = Array.from(container.querySelectorAll(".downloads-item-name")).map(
      (el) => el.textContent,
    );
    expect(names).toEqual(["new.zip", "mid.zip", "old.zip"]);
  });
});
