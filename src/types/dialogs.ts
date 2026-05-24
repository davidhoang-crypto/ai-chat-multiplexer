export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export interface TextPromptOptions {
  title: string;
  initial?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
}
