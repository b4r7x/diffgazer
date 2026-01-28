import { cn } from "@/lib/utils";

interface Hint {
  key: string;
  label: string;
}

interface DialogFooterActionsProps {
  onCancel: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
  focusedButtonIndex: number;
  isFocused: boolean;
  hints: Hint[];
}

export function DialogFooterActions({
  onCancel,
  onConfirm,
  canConfirm,
  focusedButtonIndex,
  isFocused,
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
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "text-xs text-gray-500 hover:text-tui-fg transition-colors",
            isFocused &&
              focusedButtonIndex === 0 &&
              "ring-2 ring-tui-blue rounded px-1"
          )}
        >
          [Esc] Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className={cn(
            "bg-tui-blue text-black px-4 py-1.5 text-xs font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all",
            isFocused &&
              focusedButtonIndex === 1 &&
              "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
          )}
        >
          [Enter] Confirm
        </button>
      </div>
    </>
  );
}
