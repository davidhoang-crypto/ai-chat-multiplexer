import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePromptDialogs } from "./hooks/usePromptDialogs";

describe("usePromptDialogs", () => {
  it("initializes with no prompts open", () => {
    const { result } = renderHook(() => usePromptDialogs());
    expect(result.current.textPrompt).toBeNull();
    expect(result.current.textPromptValue).toBe("");
    expect(result.current.confirmDialog).toBeNull();
  });

  it("openTextPrompt sets prompt and seeds textPromptValue with initial", () => {
    const { result } = renderHook(() => usePromptDialogs());
    const onSubmit = vi.fn();
    act(() => {
      result.current.openTextPrompt({
        title: "Rename",
        initial: "old",
        placeholder: "New name",
        onSubmit,
      });
    });
    expect(result.current.textPrompt).not.toBeNull();
    expect(result.current.textPrompt?.title).toBe("Rename");
    expect(result.current.textPrompt?.placeholder).toBe("New name");
    expect(result.current.textPromptValue).toBe("old");
  });

  it("openTextPrompt defaults initial to empty string when omitted", () => {
    const { result } = renderHook(() => usePromptDialogs());
    act(() => {
      result.current.openTextPrompt({
        title: "Add",
        onSubmit: vi.fn(),
      });
    });
    expect(result.current.textPromptValue).toBe("");
    expect(result.current.textPrompt?.initial).toBe("");
  });

  it("closeTextPrompt clears prompt and value", () => {
    const { result } = renderHook(() => usePromptDialogs());
    act(() => {
      result.current.openTextPrompt({ title: "X", initial: "abc", onSubmit: vi.fn() });
    });
    act(() => {
      result.current.closeTextPrompt();
    });
    expect(result.current.textPrompt).toBeNull();
    expect(result.current.textPromptValue).toBe("");
  });

  it("submitTextPrompt invokes onSubmit with trimmed value and closes", () => {
    const { result } = renderHook(() => usePromptDialogs());
    const onSubmit = vi.fn();
    act(() => {
      result.current.openTextPrompt({ title: "X", onSubmit });
    });
    act(() => {
      result.current.setTextPromptValue("  hello  ");
    });
    act(() => {
      result.current.submitTextPrompt();
    });
    expect(onSubmit).toHaveBeenCalledWith("hello");
    expect(result.current.textPrompt).toBeNull();
  });

  it("submitTextPrompt with empty/whitespace value closes WITHOUT calling onSubmit", () => {
    const { result } = renderHook(() => usePromptDialogs());
    const onSubmit = vi.fn();
    act(() => {
      result.current.openTextPrompt({ title: "X", onSubmit });
    });
    act(() => {
      result.current.setTextPromptValue("   ");
    });
    act(() => {
      result.current.submitTextPrompt();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.textPrompt).toBeNull();
    expect(result.current.textPromptValue).toBe("");
  });

  it("submitTextPrompt is a no-op when no prompt is open", () => {
    const { result } = renderHook(() => usePromptDialogs());
    act(() => {
      result.current.submitTextPrompt();
    });
    expect(result.current.textPrompt).toBeNull();
  });

  it("setConfirmDialog updates confirm state independently", () => {
    const { result } = renderHook(() => usePromptDialogs());
    const onConfirm = vi.fn();
    act(() => {
      result.current.setConfirmDialog({
        title: "Delete?",
        message: "Are you sure?",
        confirmLabel: "Delete",
        danger: true,
        onConfirm,
      });
    });
    expect(result.current.confirmDialog?.title).toBe("Delete?");
    expect(result.current.confirmDialog?.danger).toBe(true);
    expect(result.current.textPrompt).toBeNull();
  });
});
