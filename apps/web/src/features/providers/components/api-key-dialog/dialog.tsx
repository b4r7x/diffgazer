import { useApiKeyEntry } from "@diffgazer/core/providers";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { Callout } from "@diffgazer/ui/components/callout";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@diffgazer/ui/components/dialog";
import { useId, useRef } from "react";
import { ApiKeyMethodSelector } from "@/components/shared/api-key-method-selector";
import { ApiKeyFooter } from "./footer";
import { useApiKeyDialogKeyboard } from "./use-keyboard";

export interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  envVarName: string;
  secretsStorage?: SecretsStorage | null;
  onSubmit: (method: "paste" | "env", value: string) => Promise<boolean>;
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  providerName,
  envVarName,
  secretsStorage,
  onSubmit,
}: ApiKeyDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const storageNote =
    secretsStorage === "keyring"
      ? `Keys are stored in your OS keychain. Context is only sent to ${providerName}.`
      : `Keys are stored in a local file with OS permissions. Context is only sent to ${providerName}.`;

  const entry = useApiKeyEntry({
    envVarName,
    onSubmit,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && entry.isSubmitting) return;
    if (!nextOpen) entry.reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (method?: "paste" | "env") => {
    const saved = await entry.submit(method);
    if (saved) handleOpenChange(false);
    return saved;
  };

  const {
    focused,
    setFocused,
    getMethodOptionProps,
    handleMethodKeyDown,
    handleMethodCommit,
    getCancelProps,
    getConfirmProps,
    cancelHighlighted,
    confirmHighlighted,
  } = useApiKeyDialogKeyboard({
    open,
    method: entry.method,
    setMethod: entry.setMethod,
    canSubmit: entry.canSubmit && !entry.isSubmitting,
    isSubmitting: entry.isSubmitting,
    inputRef,
    onSubmit: handleSubmit,
    onClose: () => handleOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-xl overflow-hidden"
        closeOnBackdropClick={!entry.isSubmitting}
        onEscapeKeyDown={(event) => {
          if (entry.isSubmitting) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{providerName} API Key</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <ApiKeyMethodSelector
            value={entry.method}
            onChange={entry.setMethod}
            keyValue={entry.value}
            onKeyValueChange={entry.setValue}
            envVarName={envVarName}
            providerName={providerName}
            inputRef={inputRef}
            focused={focused}
            onFocus={setFocused}
            onKeySubmit={handleSubmit}
            onMethodCommit={handleMethodCommit}
            onInputMethodKeyDown={handleMethodKeyDown}
            getMethodOptionProps={getMethodOptionProps}
            invalid={entry.error !== null}
            errorId={errorId}
          />

          {entry.error && (
            <Callout id={errorId} tone="error" live>
              <Callout.Content>{entry.error}</Callout.Content>
            </Callout>
          )}

          <div className="text-xs text-muted-foreground border-t border-border/40 pt-3 leading-relaxed">
            Note: {storageNote}
          </div>
        </DialogBody>

        <ApiKeyFooter
          onConfirm={() => {
            void handleSubmit();
          }}
          canSubmit={entry.canSubmit}
          isSubmitting={entry.isSubmitting}
          getCancelProps={getCancelProps}
          getConfirmProps={getConfirmProps}
          cancelHighlighted={cancelHighlighted}
          confirmHighlighted={confirmHighlighted}
        />
      </DialogContent>
    </Dialog>
  );
}
