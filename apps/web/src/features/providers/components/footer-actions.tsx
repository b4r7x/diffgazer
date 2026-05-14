import { Button } from "@diffgazer/ui/components/button";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { cn } from "@diffgazer/ui/lib/utils";
import type { Ref } from "react";

interface Hint {
  key: string;
  label: string;
}

interface DialogFooterActionsProps {
  onCancel: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
  cancelFocused: boolean;
  confirmFocused: boolean;
  getButtonProps: (index: number) => {
    ref: Ref<HTMLButtonElement>;
    onFocus: () => void;
  };
  hints: Hint[];
}

export function DialogFooterActions({
  onCancel,
  onConfirm,
  canConfirm,
  cancelFocused,
  confirmFocused,
  getButtonProps,
  hints,
}: DialogFooterActionsProps) {
  return (
    <>
      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[10px] text-tui-muted">
        {hints.map((hint) => (
          <span key={hint.key}>
            <Kbd size="sm">{hint.key}</Kbd> {hint.label}
          </span>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3">
        <Button
          {...getButtonProps(0)}
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className={cn(
            "text-tui-muted hover:text-tui-fg h-auto px-2 py-1 gap-1.5",
            cancelFocused && "ring-2 ring-tui-blue"
          )}
        >
          <Kbd aria-hidden="true" size="sm">Esc</Kbd>
          Cancel
        </Button>
        <Button
          {...getButtonProps(1)}
          variant="primary"
          size="sm"
          onClick={onConfirm}
          disabled={!canConfirm}
          className={cn(
            "h-auto px-4 py-1.5 gap-1.5",
            confirmFocused && "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
          )}
        >
          <Kbd aria-hidden="true" size="sm">Enter</Kbd>
          Confirm
        </Button>
      </div>
    </>
  );
}
