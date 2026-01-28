"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useKey } from "@/hooks/keyboard";

export interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  envVarName: string;
  hasExistingKey: boolean;
  onSubmit: (method: "paste" | "env", value: string) => Promise<void>;
  onRemoveKey?: () => Promise<void>;
}

type InputMethod = "paste" | "env";

export function ApiKeyDialog({
  open,
  onOpenChange,
  providerName,
  envVarName,
  hasExistingKey,
  onSubmit,
  onRemoveKey,
}: ApiKeyDialogProps) {
  const [method, setMethod] = useState<InputMethod>("paste");
  const [keyValue, setKeyValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  type FocusZone = "options" | "input" | "footer";
  const [focusZone, setFocusZone] = useState<FocusZone>("options");
  const [optionIndex, setOptionIndex] = useState(0); // 0=paste, 1=env

  // Reset dialog state when opened
  useEffect(() => {
    if (open) {
      setKeyValue("");
      setFocusZone("options");
      setOptionIndex(0);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const value = method === "paste" ? keyValue : envVarName;
    if (!value && method === "paste") return;

    setIsSubmitting(true);
    try {
      await onSubmit(method, value);
      setKeyValue("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (isSubmitting || !onRemoveKey) return;
    setIsSubmitting(true);
    try {
      await onRemoveKey();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enter to submit (only in input zone), Escape to cancel
  useKey("Enter", handleSubmit, { enabled: open && !isSubmitting && focusZone === "input" });
  useKey("Escape", () => onOpenChange(false), { enabled: open && !isSubmitting });

  // Options zone navigation
  useKey("ArrowUp", () => {
    setOptionIndex(prev => Math.max(0, prev - 1));
  }, { enabled: open && focusZone === "options" });

  useKey("ArrowDown", () => {
    if (optionIndex < 1) {
      setOptionIndex(prev => prev + 1);
    } else if (hasExistingKey && onRemoveKey) {
      setFocusZone("footer");
    }
  }, { enabled: open && focusZone === "options" });

  useKey("Enter", () => {
    const newMethod = optionIndex === 0 ? "paste" : "env";
    setMethod(newMethod);
    if (newMethod === "paste") {
      setFocusZone("input");
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      handleSubmit();
    }
  }, { enabled: open && focusZone === "options" });

  // Input zone navigation
  useKey("ArrowUp", () => {
    inputRef.current?.blur();
    setFocusZone("options");
  }, { enabled: open && focusZone === "input" });

  useKey("ArrowDown", () => {
    if (hasExistingKey && onRemoveKey) {
      inputRef.current?.blur();
      setFocusZone("footer");
    }
  }, { enabled: open && focusZone === "input" });

  // Footer zone navigation
  useKey("ArrowUp", () => {
    setFocusZone(method === "paste" ? "input" : "options");
    if (method === "paste") {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, { enabled: open && focusZone === "footer" });

  useKey("Enter", () => {
    handleRemove();
  }, { enabled: open && focusZone === "footer" && hasExistingKey && !!onRemoveKey });

  const canSubmit = method === "env" || keyValue.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-tui-border shadow-2xl">
        {/* Header */}
        <div className="border-b border-tui-border px-5 py-3 flex justify-between items-center bg-tui-selection/50">
          <span className="font-bold text-tui-blue tracking-wide">{providerName} API Key</span>
          <Badge variant="success" size="xs" className="uppercase tracking-wider border border-tui-green/30 px-1.5 py-0.5">
            Secure
          </Badge>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Paste Key Option */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setMethod("paste");
                setOptionIndex(0);
              }}
              role="radio"
              aria-checked={method === "paste"}
              data-value="paste"
              className={cn(
                "flex items-center gap-3 w-full text-left group rounded",
                method === "paste" ? "text-tui-fg" : "text-gray-400 hover:text-tui-fg",
                focusZone === "options" && optionIndex === 0 && "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
              )}
            >
              <span className={cn("font-bold", method === "paste" ? "text-tui-blue" : "text-gray-600")}>
                {method === "paste" ? "[ ● ]" : "[   ]"}
              </span>
              <span className="font-bold group-hover:underline decoration-tui-border underline-offset-4">
                Paste Key Now
              </span>
            </button>
            {method === "paste" && (
              <div className="pl-9">
                <div className="flex items-center bg-tui-input-bg border border-tui-blue px-3 py-2 w-full">
                  <span className="text-gray-500 mr-1 select-none">KEY:</span>
                  <input
                    ref={inputRef}
                    type="password"
                    value={keyValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    className="flex-1 bg-transparent text-white tracking-widest focus:outline-none"
                    autoFocus
                  />
                  <span className="cursor-block ml-0.5" />
                </div>
              </div>
            )}
          </div>

          {/* Env Option */}
          <div
            className={cn(
              "space-y-2 transition-opacity",
              method === "env" ? "opacity-100" : "opacity-60 hover:opacity-100"
            )}
          >
            <button
              type="button"
              onClick={() => {
                setMethod("env");
                setOptionIndex(1);
              }}
              role="radio"
              aria-checked={method === "env"}
              data-value="env"
              className={cn(
                "flex items-center gap-3 w-full text-left group rounded",
                method === "env" ? "text-tui-fg" : "text-gray-400 hover:text-tui-fg",
                focusZone === "options" && optionIndex === 1 && "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
              )}
            >
              <span className={cn("font-bold", method === "env" ? "text-tui-blue" : "text-gray-600")}>
                {method === "env" ? "[ ● ]" : "[   ]"}
              </span>
              <span className="group-hover:underline decoration-tui-border underline-offset-4">
                Import from Env
              </span>
            </button>
            <div className="pl-9">
              <div className="flex items-center bg-tui-bg border border-tui-border px-3 py-2 w-full text-gray-500">
                <span className="mr-2 select-none text-gray-600">$</span>
                <span>{envVarName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <div className="text-[11px] text-gray-600 border-t border-tui-border/40 pt-3 mb-6 leading-relaxed">
            Note: Keys are encrypted in your OS keychain. Context is only sent to {providerName}.
          </div>
          <div className="flex justify-end">
            {hasExistingKey && onRemoveKey && (
              <Button
                variant="destructive"
                bracket
                onClick={handleRemove}
                disabled={isSubmitting}
                className={cn(
                  "text-tui-red hover:bg-tui-red hover:text-black px-3 py-1.5 transition-colors text-xs font-bold border border-tui-border hover:border-tui-red disabled:opacity-50",
                  focusZone === "footer" && "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
                )}
              >
                Remove Key
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
