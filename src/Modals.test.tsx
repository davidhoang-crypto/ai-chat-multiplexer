import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { ConfirmDialog, TextPromptModal } from "./components/Modals";

afterEach(cleanup);

describe("TextPromptModal", () => {
  it("renders nothing when prompt is null", () => {
    const { container } = render(
      <TextPromptModal
        prompt={null}
        value=""
        onValueChange={() => undefined}
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(container.children).toHaveLength(0);
  });

  it("renders title, placeholder, and current value", () => {
    render(
      <TextPromptModal
        prompt={{ title: "Đổi tên", initial: "old", placeholder: "ph", onSubmit: () => undefined }}
        value="hello"
        onValueChange={() => undefined}
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByText("Đổi tên")).toBeDefined();
    const input = screen.getByPlaceholderText("ph") as HTMLInputElement;
    expect(input.value).toBe("hello");
  });

  it("calls onValueChange when input changes", () => {
    const onValueChange = vi.fn();
    render(
      <TextPromptModal
        prompt={{ title: "T", initial: "", onSubmit: () => undefined }}
        value=""
        onValueChange={onValueChange}
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
    expect(onValueChange).toHaveBeenCalledWith("abc");
  });

  it("calls onSubmit when form is submitted", () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <TextPromptModal
        prompt={{ title: "T", initial: "", onSubmit: () => undefined }}
        value=""
        onValueChange={() => undefined}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.submit(container.querySelector("form")!);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("calls onClose when Hủy is clicked", () => {
    const onClose = vi.fn();
    render(
      <TextPromptModal
        prompt={{ title: "T", initial: "", onSubmit: () => undefined }}
        value=""
        onValueChange={() => undefined}
        onClose={onClose}
        onSubmit={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <TextPromptModal
        prompt={{ title: "T", initial: "", onSubmit: () => undefined }}
        value=""
        onValueChange={() => undefined}
        onClose={onClose}
        onSubmit={() => undefined}
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <TextPromptModal
        prompt={{ title: "T", initial: "", onSubmit: () => undefined }}
        value=""
        onValueChange={() => undefined}
        onClose={onClose}
        onSubmit={() => undefined}
      />,
    );
    const backdrop = container.querySelector(".modal-backdrop")!;
    fireEvent.mouseDown(backdrop, { target: backdrop, currentTarget: backdrop });
    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT call onClose when mousedown originates inside the modal-card", () => {
    const onClose = vi.fn();
    const { container } = render(
      <TextPromptModal
        prompt={{ title: "T", initial: "", onSubmit: () => undefined }}
        value=""
        onValueChange={() => undefined}
        onClose={onClose}
        onSubmit={() => undefined}
      />,
    );
    const card = container.querySelector(".modal-card")!;
    fireEvent.mouseDown(card);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT call onClose for non-Escape keydowns in the input", () => {
    const onClose = vi.fn();
    render(
      <TextPromptModal
        prompt={{ title: "T", initial: "", onSubmit: () => undefined }}
        value=""
        onValueChange={() => undefined}
        onClose={onClose}
        onSubmit={() => undefined}
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ConfirmDialog", () => {
  it("renders nothing when dialog is null", () => {
    const { container } = render(
      <ConfirmDialog dialog={null} onClose={() => undefined} />,
    );
    expect(container.children).toHaveLength(0);
  });

  it("renders title, message, and default OK label", () => {
    render(
      <ConfirmDialog
        dialog={{ title: "Xóa?", message: "Mất dữ liệu", onConfirm: () => undefined }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("Xóa?")).toBeDefined();
    expect(screen.getByText("Mất dữ liệu")).toBeDefined();
    expect(screen.getByRole("button", { name: "OK" })).toBeDefined();
  });

  it("uses custom confirmLabel when provided", () => {
    render(
      <ConfirmDialog
        dialog={{
          title: "T",
          message: "M",
          confirmLabel: "Xác nhận",
          onConfirm: () => undefined,
        }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDefined();
  });

  it("applies danger class when danger=true", () => {
    render(
      <ConfirmDialog
        dialog={{
          title: "T",
          message: "M",
          confirmLabel: "Xóa",
          danger: true,
          onConfirm: () => undefined,
        }}
        onClose={() => undefined}
      />,
    );
    const btn = screen.getByRole("button", { name: "Xóa" });
    expect(btn.className).toContain("danger");
  });

  it("calls onConfirm then onClose when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        dialog={{ title: "T", message: "M", onConfirm }}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Hủy is clicked without invoking onConfirm", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        dialog={{ title: "T", message: "M", onConfirm }}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ConfirmDialog
        dialog={{ title: "T", message: "M", onConfirm: () => undefined }}
        onClose={onClose}
      />,
    );
    const backdrop = container.querySelector(".modal-backdrop")!;
    fireEvent.mouseDown(backdrop, { target: backdrop, currentTarget: backdrop });
    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT call onClose when mousedown originates inside the card", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ConfirmDialog
        dialog={{ title: "T", message: "M", onConfirm: () => undefined }}
        onClose={onClose}
      />,
    );
    const card = container.querySelector(".modal-card")!;
    fireEvent.mouseDown(card);
    expect(onClose).not.toHaveBeenCalled();
  });
});
