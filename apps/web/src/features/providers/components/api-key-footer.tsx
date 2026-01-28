"use client";

import { DialogFooter } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ApiKeyFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  onRemove?: () => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  hasExistingKey: boolean;
  focusedIndex: number;
  inFooter: boolean;
  onButtonClick: (index: number, action: () => void) => void;
}

export function ApiKeyFooter({
  onCancel,
  onConfirm,
  onRemove,
  canSubmit,
  isSubmitting,
  hasExistingKey,
  focusedIndex,
  inFooter,
  onButtonClick,
}: ApiKeyFooterProps) {
  return (
    <DialogFooter className="justify-between">
      <div className="flex gap-3 text-[10px] text-gray-500">
        <span>↑↓ navigate</span>
        <span>Enter select</span>
      </div>
      <div className="flex gap-3 items-center">
        <button
          type="button"
          onClick={() => onButtonClick(0, onCancel)}
          className={cn(
            "text-xs text-gray-500 hover:text-tui-fg transition-colors",
            inFooter &&
              focusedIndex === 0 &&
              "ring-2 ring-tui-blue rounded px-1"
          )}
        >
          [Esc] Cancel
        </button>
        <button
          type="button"
          onClick={() => onButtonClick(1, onConfirm)}
          disabled={!canSubmit || isSubmitting}
          className={cn(
            "bg-tui-blue text-black px-4 py-1.5 text-xs font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all",
            inFooter &&
              focusedIndex === 1 &&
              "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
          )}
        >
          [Enter] Confirm
        </button>
        {hasExistingKey && onRemove && (
          <button
            type="button"
            onClick={() => onButtonClick(2, onRemove)}
            disabled={isSubmitting}
            className={cn(
              "text-tui-red hover:bg-tui-red hover:text-black px-3 py-1.5 text-xs font-bold border border-tui-border hover:border-tui-red disabled:opacity-50 transition-colors",
              inFooter &&
                focusedIndex === 2 &&
                "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
            )}
          >
            Remove Key
          </button>
        )}
      </div>
    </DialogFooter>
  );
}
