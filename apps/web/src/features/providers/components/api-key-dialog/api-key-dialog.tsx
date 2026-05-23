import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@diffgazer/ui/components/dialog";
import { useApiKeyForm } from "../../hooks/use-api-key-form";
import { useApiKeyDialogKeyboard } from "../../hooks/use-api-key-dialog-keyboard";
import { ApiKeyMethodSelector } from "@/components/shared/api-key-method-selector";
import { ApiKeyFooter } from "./api-key-footer";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";

import type { FocusElement } from "@/types/focus-element";

export type { FocusElement };

export interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  providerId?: string;
  envVarName: string;
  secretsStorage?: SecretsStorage | null;
  onSubmit: (method: "paste" | "env", value: string) => Promise<void>;
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  providerName,
  providerId,
  envVarName,
  secretsStorage,
  onSubmit,
}: ApiKeyDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const storageNote =
    secretsStorage === "keyring"
      ? `Keys are stored in your OS keychain. Context is only sent to ${providerName}.`
      : `Keys are stored in a local file with OS permissions. Context is only sent to ${providerName}.`;

  const form = useApiKeyForm({
    envVarName,
    onSubmit,
    onOpenChange,
    resetKey: `${providerId ?? providerName}:${open}`,
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
        <DialogHeader marker="none" className="bg-tui-selection/50 px-4 py-3">
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
            Note: {storageNote}
          </div>
        </DialogBody>

        <ApiKeyFooter
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
