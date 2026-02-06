"use client";

import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import type { FocusElement } from "./api-key-dialog";

interface ApiKeyFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  onRemove?: () => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  hasExistingKey: boolean;
  focused: FocusElement;
  onFocus: (element: FocusElement) => void;
}

export function ApiKeyFooter({
  onCancel,
  onConfirm,
  onRemove,
  canSubmit,
  isSubmitting,
  hasExistingKey,
  focused,
  onFocus,
}: ApiKeyFooterProps) {
  return (
    <DialogFooter className="justify-between">
      <div className="flex gap-3 text-[10px] text-gray-500">
        <span>↑↓ navigate</span>
        <span>Enter select</span>
      </div>
      <div className="flex gap-3 items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          onMouseDown={() => onFocus("cancel")}
          className={cn(
            "text-gray-500 hover:text-tui-fg h-auto px-2 py-1",
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
        {hasExistingKey && onRemove && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onRemove}
            onMouseDown={() => onFocus("remove")}
            disabled={isSubmitting}
            className={cn(
              "h-auto px-3 py-1.5",
              focused === "remove" &&
                "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
            )}
          >
            Remove Key
          </Button>
        )}
      </div>
    </DialogFooter>
  );
}
