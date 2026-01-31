import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

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
  hints: Hint[];
}

export function DialogFooterActions({
  onCancel,
  onConfirm,
  canConfirm,
  cancelFocused,
  confirmFocused,
  hints,
}: DialogFooterActionsProps) {
  return (
    <>
      <div className="flex gap-3 text-[10px] text-gray-500">
        {hints.map((hint) => (
          <span key={hint.key}>
            {hint.key} {hint.label}
          </span>
        ))}
      </div>
      <div className="flex gap-3 items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className={cn(
            "text-gray-500 hover:text-tui-fg h-auto px-2 py-1",
            cancelFocused && "ring-2 ring-tui-blue"
          )}
        >
          [Esc] Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirm}
          disabled={!canConfirm}
          className={cn(
            "h-auto px-4 py-1.5",
            confirmFocused && "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
          )}
        >
          [Enter] Confirm
        </Button>
      </div>
    </>
  );
}
