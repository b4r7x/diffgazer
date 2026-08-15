import {
  DialogAction,
  DialogClose,
  DialogFooter,
  type KeyboardHint,
} from "@diffgazer/ui/components/dialog";
import type { RefCallback } from "react";

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

// The legend every dialog with a default action reads, in press order: pick a method,
// save, back out. Enter is spelled once, against the verb the default action performs.
const HINTS: KeyboardHint[] = [
  { key: "Space", label: "Select" },
  { key: "Enter", label: "Save" },
  { key: "Esc", label: "Cancel" },
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
  const cancelProps = getCancelProps();
  const confirmProps = getConfirmProps();

  return (
    <DialogFooter hints={HINTS}>
      <DialogClose
        ref={cancelProps.ref}
        variant="ghost"
        size="sm"
        bracket
        disabled={isSubmitting}
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
        disabled={!canSubmit}
        highlighted={confirmHighlighted}
        onClick={(event) => {
          event.preventDefault();
          onConfirm();
        }}
        onFocus={confirmProps.onFocus}
      >
        {isSubmitting ? "Saving..." : "Save"}
      </DialogAction>
    </DialogFooter>
  );
}
