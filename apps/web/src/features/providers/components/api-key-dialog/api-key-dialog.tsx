import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  Badge,
} from "@diffgazer/ui";
import { useApiKeyForm } from "../../hooks/use-api-key-form";
import { useApiKeyDialogKeyboard } from "../../hooks/use-api-key-dialog-keyboard";
import { ApiKeyMethodSelector } from "./api-key-method-selector";
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

  const { focused, setFocused } = useApiKeyDialogKeyboard({
    open,
    method: form.method,
    setMethod: form.setMethod,
    canSubmit: form.canSubmit,
    inputRef,
    onSubmit: form.handleSubmit,
    onClose: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={String(open)} className="max-w-lg border border-tui-border shadow-2xl">
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
            focused={focused}
            onFocus={setFocused}
            onKeySubmit={form.handleSubmit}
          />

          <div className="text-[11px] text-muted-foreground border-t border-tui-border/40 pt-3 leading-relaxed">
            Note: Keys are encrypted in your OS keychain. Context is only sent to{" "}
            {providerName}.
          </div>
        </DialogBody>

        <ApiKeyFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={form.handleSubmit}
          canSubmit={form.canSubmit}
          isSubmitting={form.isSubmitting}
          focused={focused}
          onFocus={setFocused}
        />
      </DialogContent>
    </Dialog>
  );
}
