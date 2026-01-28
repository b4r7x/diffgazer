"use client";

import { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  Badge,
} from "@/components/ui";
import { useFooterNavigation } from "@/hooks/keyboard";
import { useApiKeyForm } from "./use-api-key-form";
import { ApiKeyMethodSelector } from "./api-key-method-selector";
import { ApiKeyFooter } from "./api-key-footer";

export interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  envVarName: string;
  hasExistingKey: boolean;
  onSubmit: (method: "paste" | "env", value: string) => Promise<void>;
  onRemoveKey?: () => Promise<void>;
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  providerName,
  envVarName,
  hasExistingKey,
  onSubmit,
  onRemoveKey,
}: ApiKeyDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasRemoveKey = Boolean(onRemoveKey);
  const buttonCount = hasExistingKey && hasRemoveKey ? 3 : 2;

  const [pendingAction, setPendingAction] = useState<number | null>(null);

  const footer = useFooterNavigation({
    enabled: open,
    buttonCount,
    onAction: setPendingAction,
  });

  const form = useApiKeyForm({
    open,
    envVarName,
    hasExistingKey,
    hasRemoveKey,
    onSubmit,
    onRemoveKey,
    onOpenChange,
    onResetFooter: footer.reset,
  });

  // Execute pending action from keyboard navigation
  useEffect(() => {
    if (pendingAction === null || form.isSubmitting) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action === 0) {
      onOpenChange(false);
    } else if (action === 1) {
      form.handleSubmit();
    } else if (action === 2 && hasRemoveKey) {
      form.handleRemove();
    }
  }, [pendingAction, form.isSubmitting, onOpenChange, hasRemoveKey]);

  const handleBoundaryReached = (direction: "up" | "down") => {
    if (direction === "down") {
      footer.enterFooter(hasExistingKey && hasRemoveKey ? 1 : 0);
    }
  };

  const handleButtonClick = (index: number, action: () => void) => {
    footer.enterFooter(index);
    action();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-tui-border shadow-2xl">
        <DialogHeader className="bg-tui-selection/50">
          <DialogTitle className="text-tui-blue tracking-wide">
            {providerName} API Key
          </DialogTitle>
          <Badge
            variant="success"
            size="sm"
            className="uppercase tracking-wider border border-tui-green/30 px-1.5 py-0.5"
            aria-label="Keys are stored securely"
          >
            Secure
          </Badge>
        </DialogHeader>

        <DialogBody className="p-6 space-y-6">
          <ApiKeyMethodSelector
            method={form.method}
            onMethodChange={form.setMethod}
            keyValue={form.keyValue}
            onKeyValueChange={form.setKeyValue}
            envVarName={envVarName}
            providerName={providerName}
            inputRef={inputRef}
            onBoundaryReached={handleBoundaryReached}
            onKeySubmit={form.handleSubmit}
          />

          <div className="text-[11px] text-gray-600 border-t border-tui-border/40 pt-3 leading-relaxed">
            Note: Keys are encrypted in your OS keychain. Context is only sent to{" "}
            {providerName}.
          </div>
        </DialogBody>

        <ApiKeyFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={form.handleSubmit}
          onRemove={onRemoveKey ? form.handleRemove : undefined}
          canSubmit={form.canSubmit}
          isSubmitting={form.isSubmitting}
          hasExistingKey={hasExistingKey}
          focusedIndex={footer.focusedIndex}
          inFooter={footer.inFooter}
          onButtonClick={handleButtonClick}
        />
      </DialogContent>
    </Dialog>
  );
}
