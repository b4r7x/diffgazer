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

type InputMethod = "paste" | "env" | "stdin";

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

  // Focus input when paste method selected
  useEffect(() => {
    if (open && method === "paste") {
      inputRef.current?.focus();
    }
  }, [open, method]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const value = method === "paste" ? keyValue : envVarName;
    if (!value && method === "paste") return;

    setIsSubmitting(true);
    try {
      await onSubmit(method === "stdin" ? "env" : method, value);
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

  // Enter to submit, Escape to cancel
  useKey("Enter", handleSubmit, { enabled: open && !isSubmitting });
  useKey("Escape", () => onOpenChange(false), { enabled: open && !isSubmitting });

  const canSubmit = method === "env" || method === "stdin" || keyValue.length > 0;

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
              onClick={() => setMethod("paste")}
              className={cn(
                "flex items-center gap-3 w-full text-left group",
                method === "paste" ? "text-tui-fg" : "text-gray-400 hover:text-tui-fg"
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
              onClick={() => setMethod("env")}
              className={cn(
                "flex items-center gap-3 w-full text-left group",
                method === "env" ? "text-tui-fg" : "text-gray-400 hover:text-tui-fg"
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

          {/* Stdin Option */}
          <div
            className={cn(
              "space-y-2 transition-opacity",
              method === "stdin" ? "opacity-100" : "opacity-60 hover:opacity-100"
            )}
          >
            <button
              type="button"
              onClick={() => setMethod("stdin")}
              className={cn(
                "flex items-center gap-3 w-full text-left group",
                method === "stdin" ? "text-tui-fg" : "text-gray-400 hover:text-tui-fg"
              )}
            >
              <span className={cn("font-bold", method === "stdin" ? "text-tui-blue" : "text-gray-600")}>
                {method === "stdin" ? "[ ● ]" : "[   ]"}
              </span>
              <span className="group-hover:underline decoration-tui-border underline-offset-4">
                Read from Stdin
              </span>
            </button>
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
                className="text-tui-red hover:bg-tui-red hover:text-black px-3 py-1.5 transition-colors text-xs font-bold border border-tui-border hover:border-tui-red disabled:opacity-50"
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
