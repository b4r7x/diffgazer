import type { RefObject } from "react";
import {
  DialogAction,
  DialogClose,
  DialogFooter,
  type KeyboardHint,
} from "@diffgazer/ui/components/dialog";
import type { FocusElement } from "@/types/focus-element";

interface ApiKeyFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  focused: FocusElement;
  onFocus: (element: FocusElement) => void;
  cancelRef: RefObject<HTMLButtonElement | null>;
  confirmRef: RefObject<HTMLButtonElement | null>;
}

const HINTS: KeyboardHint[] = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Enter/Space", label: "Select" },
  { key: "Esc", label: "Cancel" },
  { key: "Enter", label: "Confirm" },
];

export function ApiKeyFooter({
  onCancel,
  onConfirm,
  canSubmit,
  isSubmitting,
  focused,
  onFocus,
  cancelRef,
  confirmRef,
}: ApiKeyFooterProps) {
  const canConfirm = canSubmit && !isSubmitting;

  return (
    <DialogFooter hints={HINTS}>
      <DialogClose
        ref={cancelRef}
        variant="ghost"
        size="sm"
        bracket
        highlighted={focused === "cancel"}
        onClick={onCancel}
        onFocus={() => onFocus("cancel")}
      >
        Cancel
      </DialogClose>
      <DialogAction
        ref={confirmRef}
        variant="primary"
        size="sm"
        bracket
        disabled={!canConfirm}
        highlighted={focused === "confirm" && canConfirm}
        onClick={(event) => {
          event.preventDefault();
          onConfirm();
        }}
        onFocus={() => onFocus("confirm")}
      >
        Confirm
      </DialogAction>
    </DialogFooter>
  );
}
