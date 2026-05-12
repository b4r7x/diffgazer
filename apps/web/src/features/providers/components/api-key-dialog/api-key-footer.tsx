import type { RefObject } from "react";
import { DialogFooter } from "@diffgazer/ui/components/dialog";
import { Button } from "@diffgazer/ui/components/button";
import { cn } from "@diffgazer/core/cn";
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
      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[10px] text-tui-muted">
        <span>↑↓ navigate</span>
        <span>Space select</span>
        <span>Enter confirm</span>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3">
        <Button
          ref={cancelRef}
          variant="ghost"
          size="sm"
          onClick={onCancel}
          onFocus={() => onFocus("cancel")}
          className={cn(
            "text-tui-muted hover:text-tui-fg h-auto px-2 py-1",
            focused === "cancel" && "ring-2 ring-tui-blue"
          )}
        >
          [Esc] Cancel
        </Button>
        <Button
          ref={confirmRef}
          variant="primary"
          size="sm"
          onClick={onConfirm}
          onFocus={() => onFocus("confirm")}
          disabled={!canSubmit || isSubmitting}
          className={cn(
            "h-auto px-4 py-1.5",
            focused === "confirm" && canSubmit && !isSubmitting &&
              "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
          )}
        >
          [Enter] Confirm
        </Button>
      </div>
    </DialogFooter>
  );
}
