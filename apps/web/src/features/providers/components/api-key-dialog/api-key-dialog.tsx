import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useKey } from "@/hooks/keyboard";
import { useApiKeyForm } from "../../hooks/use-api-key-form";
import { ApiKeyMethodSelector } from "./api-key-method-selector";
import { ApiKeyFooter } from "./api-key-footer";

export type FocusElement = "paste" | "input" | "env" | "cancel" | "confirm" | "remove";

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
  const [focused, setFocused] = useState<FocusElement>("paste");

  const form = useApiKeyForm({
    envVarName,
    onSubmit,
    onRemoveKey,
    onOpenChange,
  });

  const footerElements: FocusElement[] = onRemoveKey
    ? ["cancel", "confirm", "remove"]
    : ["cancel", "confirm"];
  const allElements: FocusElement[] = ["paste", "input", "env", ...footerElements];

  useKey(
    "ArrowDown",
    () => {
      const idx = allElements.indexOf(focused);
      setFocused(allElements[(idx + 1) % allElements.length]);
    },
    { enabled: open }
  );

  useKey(
    "ArrowUp",
    () => {
      const idx = allElements.indexOf(focused);
      setFocused(allElements[(idx - 1 + allElements.length) % allElements.length]);
    },
    { enabled: open }
  );

  useKey(
    "ArrowRight",
    () => {
      if (!footerElements.includes(focused)) return;
      const idx = footerElements.indexOf(focused);
      setFocused(footerElements[(idx + 1) % footerElements.length]);
    },
    { enabled: open }
  );

  useKey(
    "ArrowLeft",
    () => {
      if (!footerElements.includes(focused)) return;
      const idx = footerElements.indexOf(focused);
      setFocused(footerElements[(idx - 1 + footerElements.length) % footerElements.length]);
    },
    { enabled: open }
  );

  const handleSelect = () => {
    if (focused === "paste") {
      form.setMethod("paste");
    } else if (focused === "input") {
      form.setMethod("paste");
      inputRef.current?.focus();
    } else if (focused === "env") {
      form.setMethod("env");
    } else if (focused === "cancel") {
      onOpenChange(false);
    } else if (focused === "confirm" && form.canSubmit) {
      form.handleSubmit();
    } else if (focused === "remove" && onRemoveKey) {
      form.handleRemove();
    }
  };

  useKey("Enter", handleSelect, { enabled: open && focused !== "input" });
  useKey(" ", handleSelect, { enabled: open && focused !== "input" });

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
          focused={focused}
          onFocus={setFocused}
        />
      </DialogContent>
    </Dialog>
  );
}
