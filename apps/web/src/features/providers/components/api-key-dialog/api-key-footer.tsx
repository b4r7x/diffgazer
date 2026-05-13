import type { RefObject } from "react";
import { DialogFooter } from "@diffgazer/ui/components/dialog";
import type { FocusElement } from "@/types/focus-element";
import { DialogFooterActions } from "../footer-actions";

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
  return (
    <DialogFooter className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <DialogFooterActions
        onCancel={onCancel}
        onConfirm={onConfirm}
        canConfirm={canSubmit && !isSubmitting}
        cancelFocused={focused === "cancel"}
        confirmFocused={focused === "confirm" && canSubmit && !isSubmitting}
        getButtonProps={(index) => ({
          ref: index === 0 ? cancelRef : confirmRef,
          onFocus: () => onFocus(index === 0 ? "cancel" : "confirm"),
        })}
        hints={[
          { key: "Up/Down", label: "navigate" },
          { key: "Space", label: "select" },
          { key: "Enter", label: "confirm" },
        ]}
      />
    </DialogFooter>
  );
}
