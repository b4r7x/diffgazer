import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@diffgazer/ui/components/dialog";
import { useApiKeyForm } from "../../hooks/use-api-key-form";
import { useApiKeyDialogKeyboard } from "../../hooks/use-api-key-dialog-keyboard";
import { ApiKeyMethodSelector } from "@/components/shared/api-key-method-selector";
import { ApiKeyFooter } from "./api-key-footer";

import type { FocusElement } from "@/types/focus-element";

export type { FocusElement };

export interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  envVarName: string;
  onSubmit: (method: "paste" | "env", value: string) => Promise<void>;
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  providerName,
  envVarName,
  onSubmit,
}: ApiKeyDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const form = useApiKeyForm({
    envVarName,
    onSubmit,
    onOpenChange,
  });

  const {
    focused,
    setFocused,
    getMethodOptionProps,
    handleMethodKeyDown,
    getCancelProps,
    getConfirmProps,
    cancelHighlighted,
    confirmHighlighted,
  } = useApiKeyDialogKeyboard({
    open,
    method: form.method,
    setMethod: form.setMethod,
    canSubmit: form.canSubmit && !form.isSubmitting,
    isSubmitting: form.isSubmitting,
    inputRef,
    onSubmit: form.handleSubmit,
    onClose: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden border border-tui-border shadow-2xl">
        <DialogHeader className="bg-tui-selection/50 px-4 py-3">
          <DialogTitle className="min-w-0 flex-1 w-auto text-tui-blue tracking-wide">
            {providerName} API Key
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="p-6 space-y-6">
          <ApiKeyMethodSelector
            value={form.method}
            onChange={form.setMethod}
            keyValue={form.keyValue}
            onKeyValueChange={form.setKeyValue}
            envVarName={envVarName}
            providerName={providerName}
            inputRef={inputRef}
            focused={focused}
            onFocus={setFocused}
            onKeySubmit={form.handleSubmit}
            onInputMethodKeyDown={handleMethodKeyDown}
            getMethodOptionProps={getMethodOptionProps}
          />

          <div className="text-[11px] text-muted-foreground border-t border-tui-border/40 pt-3 leading-relaxed">
            Note: Keys are encrypted in your OS keychain. Context is only sent to{" "}
            {providerName}.
          </div>
        </DialogBody>

        <ApiKeyFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={() => {
            void form.handleSubmit();
          }}
          canSubmit={form.canSubmit}
          isSubmitting={form.isSubmitting}
          getCancelProps={getCancelProps}
          getConfirmProps={getConfirmProps}
          cancelHighlighted={cancelHighlighted}
          confirmHighlighted={confirmHighlighted}
        />
      </DialogContent>
    </Dialog>
  );
}
