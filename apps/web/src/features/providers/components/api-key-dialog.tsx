"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Badge,
  Input,
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui";
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
  const [inFooter, setInFooter] = useState(false);
  const [footerButtonIndex, setFooterButtonIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Reset dialog state when opened
  useEffect(() => {
    if (open) {
      setKeyValue("");
      setInFooter(false);
      setMethod("paste");
      setFooterButtonIndex(hasExistingKey && onRemoveKey ? 1 : 0);
    }
  }, [open, hasExistingKey, onRemoveKey]);

  const handleCancel = () => {
    onOpenChange(false);
  };

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

  // Handle radio selection - focus input when paste selected
  const handleMethodChange = (value: string) => {
    const newMethod = value as InputMethod;
    setMethod(newMethod);
    if (newMethod === "paste") {
      // Focus input after state updates
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  // Handle boundary reached from radio group - go to footer on down
  const handleBoundaryReached = (direction: "up" | "down") => {
    if (direction === "down") {
      setInFooter(true);
      setFooterButtonIndex(hasExistingKey && onRemoveKey ? 1 : 0);
    }
  };

  // Footer zone: ArrowUp returns to options
  useKey(
    "ArrowUp",
    () => {
      setInFooter(false);
    },
    { enabled: open && inFooter }
  );

  // Footer zone: ArrowLeft/Right to navigate between buttons
  useKey(
    "ArrowLeft",
    () => {
      if (hasExistingKey && onRemoveKey) {
        setFooterButtonIndex((prev) => (prev > 0 ? prev - 1 : 2));
      } else {
        setFooterButtonIndex((prev) => (prev > 0 ? prev - 1 : 1));
      }
    },
    { enabled: open && inFooter }
  );

  useKey(
    "ArrowRight",
    () => {
      const maxIndex = hasExistingKey && onRemoveKey ? 2 : 1;
      setFooterButtonIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    },
    { enabled: open && inFooter }
  );

  // Footer zone: Enter/Space triggers focused button
  const handleFooterAction = () => {
    if (footerButtonIndex === 0) {
      handleCancel();
    } else if (footerButtonIndex === 1) {
      handleSubmit();
    } else if (footerButtonIndex === 2 && hasExistingKey && onRemoveKey) {
      handleRemove();
    }
  };

  useKey("Enter", handleFooterAction, {
    enabled: open && inFooter && !isSubmitting,
  });

  useKey(" ", handleFooterAction, {
    enabled: open && inFooter && !isSubmitting,
  });

  const canSubmit = method === "env" || keyValue.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-tui-border shadow-2xl">
        <DialogHeader className="bg-tui-selection/50">
          <DialogTitle className="text-tui-blue tracking-wide">
            {providerName} API Key
          </DialogTitle>
          <Badge
            variant="success"
            size="xs"
            className="uppercase tracking-wider border border-tui-green/30 px-1.5 py-0.5"
            aria-label="Keys are stored securely"
          >
            Secure
          </Badge>
        </DialogHeader>

        <DialogBody className="p-6 space-y-6">
          <RadioGroup
            value={method}
            onValueChange={handleMethodChange}
            wrap={false}
            onBoundaryReached={handleBoundaryReached}
            aria-label="API key input method"
          >
            <div className="space-y-2 mb-4">
              <RadioGroupItem value="paste" label="Paste Key Now" />
              {method === "paste" && (
                <div className="pl-9">
                  <div className="flex items-center bg-tui-input-bg border border-tui-blue px-3 py-2 w-full">
                    <span className="text-gray-500 mr-1 select-none">KEY:</span>
                    <Input
                      ref={inputRef}
                      type="password"
                      value={keyValue}
                      onChange={(e) => setKeyValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      aria-label={`${providerName} API Key`}
                      className="flex-1 bg-transparent text-white tracking-widest border-0 focus:ring-0 h-auto p-0"
                    />
                  </div>
                </div>
              )}
            </div>
            <div
              className={cn(
                "space-y-2 transition-opacity",
                method === "env" ? "opacity-100" : "opacity-60 hover:opacity-100"
              )}
            >
              <RadioGroupItem value="env" label="Import from Env" />
              <div className="pl-9">
                <div className="flex items-center bg-tui-bg border border-tui-border px-3 py-2 w-full text-gray-500">
                  <span className="mr-2 select-none text-gray-600">$</span>
                  <span>{envVarName}</span>
                </div>
              </div>
            </div>
          </RadioGroup>

          <div className="text-[11px] text-gray-600 border-t border-tui-border/40 pt-3 leading-relaxed">
            Note: Keys are encrypted in your OS keychain. Context is only sent to{" "}
            {providerName}.
          </div>
        </DialogBody>

        <DialogFooter className="justify-between">
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span>↑↓ navigate</span>
            <span>Enter select</span>
          </div>
          <div className="flex gap-3 items-center">
            <button
              type="button"
              onClick={() => {
                setInFooter(true);
                setFooterButtonIndex(0);
                handleCancel();
              }}
              className={cn(
                "text-xs text-gray-500 hover:text-tui-fg transition-colors",
                inFooter &&
                  footerButtonIndex === 0 &&
                  "ring-2 ring-tui-blue rounded px-1"
              )}
            >
              [Esc] Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setInFooter(true);
                setFooterButtonIndex(1);
                handleSubmit();
              }}
              disabled={!canSubmit || isSubmitting}
              className={cn(
                "bg-tui-blue text-black px-4 py-1.5 text-xs font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all",
                inFooter &&
                  footerButtonIndex === 1 &&
                  "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
              )}
            >
              [Enter] Confirm
            </button>
            {hasExistingKey && onRemoveKey && (
              <button
                type="button"
                onClick={() => {
                  setInFooter(true);
                  setFooterButtonIndex(2);
                  handleRemove();
                }}
                disabled={isSubmitting}
                className={cn(
                  "text-tui-red hover:bg-tui-red hover:text-black px-3 py-1.5 text-xs font-bold border border-tui-border hover:border-tui-red disabled:opacity-50 transition-colors",
                  inFooter &&
                    footerButtonIndex === 2 &&
                    "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
                )}
              >
                Remove Key
              </button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
