import { DialogFooter, Button } from "@stargazer/ui";
import { cn } from "@/utils/cn";
import type { FocusElement } from "@/types/focus-element";

interface ApiKeyFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  focused: FocusElement;
  onFocus: (element: FocusElement) => void;
}

export function ApiKeyFooter({
  onCancel,
  onConfirm,
  canSubmit,
  isSubmitting,
  focused,
  onFocus,
}: ApiKeyFooterProps) {
  return (
    <DialogFooter className="justify-between">
      <div className="flex gap-3 text-[10px] text-tui-muted">
        <span>↑↓ navigate</span>
        <span>Space select</span>
        <span>Enter confirm</span>
      </div>
      <div className="flex gap-3 items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          onMouseDown={() => onFocus("cancel")}
          className={cn(
            "text-tui-muted hover:text-tui-fg h-auto px-2 py-1",
            focused === "cancel" && "ring-2 ring-tui-blue"
          )}
        >
          [Esc] Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirm}
          onMouseDown={() => onFocus("confirm")}
          disabled={!canSubmit || isSubmitting}
          className={cn(
            "h-auto px-4 py-1.5",
            focused === "confirm" &&
              "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
          )}
        >
          [Enter] Confirm
        </Button>
      </div>
    </DialogFooter>
  );
}
