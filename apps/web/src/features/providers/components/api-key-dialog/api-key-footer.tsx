import type { RefCallback } from "react";
import {
  DialogAction,
  DialogClose,
  DialogFooter,
  type KeyboardHint,
} from "@diffgazer/ui/components/dialog";

interface FooterButtonProps {
  ref: RefCallback<HTMLButtonElement>;
  onFocus: () => void;
}

interface ApiKeyFooterProps {
  onConfirm: () => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  getCancelProps: () => FooterButtonProps;
  getConfirmProps: () => FooterButtonProps;
  cancelHighlighted: boolean;
  confirmHighlighted: boolean;
}

const HINTS: KeyboardHint[] = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Enter/Space", label: "Select" },
  { key: "Esc", label: "Cancel" },
  { key: "Enter", label: "Confirm" },
];

export function ApiKeyFooter({
  onConfirm,
  canSubmit,
  isSubmitting,
  getCancelProps,
  getConfirmProps,
  cancelHighlighted,
  confirmHighlighted,
}: ApiKeyFooterProps) {
  const canConfirm = canSubmit && !isSubmitting;
  const cancelProps = getCancelProps();
  const confirmProps = getConfirmProps();

  return (
    <DialogFooter hints={HINTS}>
      <DialogClose
        ref={cancelProps.ref}
        variant="ghost"
        size="sm"
        bracket
        highlighted={cancelHighlighted}
        onFocus={cancelProps.onFocus}
      >
        Cancel
      </DialogClose>
      <DialogAction
        ref={confirmProps.ref}
        variant="primary"
        size="sm"
        bracket
        disabled={!canConfirm}
        highlighted={confirmHighlighted}
        onClick={(event) => {
          event.preventDefault();
          onConfirm();
        }}
        onFocus={confirmProps.onFocus}
      >
        Confirm
      </DialogAction>
    </DialogFooter>
  );
}
