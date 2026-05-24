import { useState } from "react";
import type { ConfirmDialogOptions, TextPromptOptions } from "../types/dialogs";

export interface UsePromptDialogsResult {
  textPrompt: {
    title: string;
    initial: string;
    placeholder?: string;
    onSubmit: (value: string) => void;
  } | null;
  textPromptValue: string;
  setTextPromptValue: (value: string) => void;
  confirmDialog: ConfirmDialogOptions | null;
  setConfirmDialog: (dialog: ConfirmDialogOptions | null) => void;
  openTextPrompt: (opts: TextPromptOptions) => void;
  closeTextPrompt: () => void;
  submitTextPrompt: () => void;
}

export function usePromptDialogs(): UsePromptDialogsResult {
  const [textPrompt, setTextPrompt] = useState<{
    title: string;
    initial: string;
    placeholder?: string;
    onSubmit: (value: string) => void;
  } | null>(null);
  const [textPromptValue, setTextPromptValue] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  function openTextPrompt(opts: TextPromptOptions) {
    setTextPromptValue(opts.initial ?? "");
    setTextPrompt({
      title: opts.title,
      initial: opts.initial ?? "",
      placeholder: opts.placeholder,
      onSubmit: opts.onSubmit,
    });
  }

  function closeTextPrompt() {
    setTextPrompt(null);
    setTextPromptValue("");
  }

  function submitTextPrompt() {
    if (!textPrompt) return;
    const trimmed = textPromptValue.trim();
    if (!trimmed) {
      closeTextPrompt();
      return;
    }
    textPrompt.onSubmit(trimmed);
    closeTextPrompt();
  }

  return {
    textPrompt,
    textPromptValue,
    setTextPromptValue,
    confirmDialog,
    setConfirmDialog,
    openTextPrompt,
    closeTextPrompt,
    submitTextPrompt,
  };
}
