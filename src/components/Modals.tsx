type TextPromptState = {
  title: string;
  initial: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
};

export type TextPromptModalProps = {
  prompt: TextPromptState | null;
  value: string;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function TextPromptModal({
  prompt,
  value,
  onValueChange,
  onClose,
  onSubmit,
}: TextPromptModalProps) {
  if (!prompt) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="modal-card"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <h3 className="modal-title">{prompt.title}</h3>
        <input
          autoFocus
          className="modal-input"
          value={value}
          placeholder={prompt.placeholder}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <div className="modal-actions">
          <button type="button" className="modal-btn" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="modal-btn primary">
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
}

export type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
};

export type ConfirmDialogProps = {
  dialog: ConfirmDialogState | null;
  onClose: () => void;
};

export function ConfirmDialog({ dialog, onClose }: ConfirmDialogProps) {
  if (!dialog) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <h3 className="modal-title">{dialog.title}</h3>
        <p className="modal-message">{dialog.message}</p>
        <div className="modal-actions">
          <button type="button" className="modal-btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className={dialog.danger ? "modal-btn danger" : "modal-btn primary"}
            onClick={() => {
              dialog.onConfirm();
              onClose();
            }}
          >
            {dialog.confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
