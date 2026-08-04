import type { ProviderListRow, ProviderManagementOutcome } from "@diffgazer/core/providers";
import {
  buildSetupAcknowledgement,
  buildSetupInput,
  CREDENTIAL_ENV_VARS,
  getSetupLayoutCopy,
  resolveSetupTransportFamily,
  toSetupCredential,
  useApiKeyEntry,
} from "@diffgazer/core/providers";
import type {
  ClientConfigurationInput,
  ReadinessAcknowledgement,
  SecretsStorage,
} from "@diffgazer/core/schemas/config";
import { Callout } from "@diffgazer/ui/components/callout";
import { Checkbox } from "@diffgazer/ui/components/checkbox";
import {
  Dialog,
  DialogBody,
  DialogCloseIcon,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@diffgazer/ui/components/dialog";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { ApiKeyMethodSelector } from "@/components/shared/api-key-method-selector";
import { ApiKeyFooter } from "./footer";
import { useApiKeyDialogKeyboard } from "./use-keyboard";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;

export interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ProviderListRow;
  secretsStorage?: SecretsStorage | null;
  onCreate: (
    input: ClientConfigurationInput,
    options?: { continueToModelSelection?: boolean },
  ) => Promise<ProviderManagementOutcome>;
  onUpdate: (
    input: {
      input: ClientConfigurationInput;
      acknowledgement: AcceptedAcknowledgement;
    },
    options?: { continueToModelSelection?: boolean },
  ) => Promise<ProviderManagementOutcome>;
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  row,
  secretsStorage,
  onCreate,
  onUpdate,
}: ApiKeyDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acknowledgementRef = useRef<HTMLElement>(null);
  const errorId = useId();
  const transportFamily = resolveSetupTransportFamily(row);
  const isHosted = transportFamily === "hosted-api";
  // The server never sends the variable name it will read, so the preview comes from
  // core's client-safe mirror. A product that binds no variable has no entry and the
  // selector falls back to its generic copy.
  const envVarName =
    row.product.status === "supported" ? CREDENTIAL_ENV_VARS[row.product.productId] : undefined;
  const isUpdating =
    row.configuration?.status === "supported" || row.configuration?.status === "removed";
  const continueToModelSelection = row.product.productId === "openrouter";
  const [noticeAccepted, setNoticeAccepted] = useState(
    () => row.readiness.acknowledgement.status === "accepted",
  );

  const storageNote =
    secretsStorage === "keyring"
      ? `Keys are stored in your OS keychain. Context is only sent to ${row.product.name}.`
      : `Keys are stored in a local file with OS permissions. Context is only sent to ${row.product.name}.`;

  // Every save family -- hosted credential, local HTTP, local CLI -- runs through
  // this one guarded machine, so a rejected save reports in place instead of
  // escaping the click handler as an unhandled rejection.
  const entry = useApiKeyEntry({
    onSubmit: async (method, value) => {
      if (!noticeAccepted) return false;
      const input = buildSetupInput(row, transportFamily, toSetupCredential(method, value));
      if (!input) return false;

      const outcome =
        row.configuration?.status === "supported"
          ? await onUpdate(
              { input, acknowledgement: buildSetupAcknowledgement(row) },
              { continueToModelSelection },
            )
          : await onCreate(input, { continueToModelSelection });

      // The management machine catches every rejection and reports it as an
      // outcome; rethrowing hands the message to the entry error channel, which
      // is this dialog's single error owner.
      if (outcome.status === "failed") throw new Error(outcome.message);
      return outcome.status === "succeeded";
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && entry.isSubmitting) return;
    if (!nextOpen) entry.reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (method?: "paste" | "env") => {
    // Local transports carry no typed credential, so they submit in the mode
    // that does not require an entry value.
    const saved = await entry.submit(isHosted ? method : "env");
    if (saved) handleOpenChange(false);
    return saved;
  };

  const canConfirm = isHosted
    ? (entry.method === "env" || entry.value.length > 0) && noticeAccepted && !entry.isSubmitting
    : noticeAccepted && !entry.isSubmitting;

  const {
    focused,
    setFocused,
    getMethodOptionProps,
    handleMethodKeyDown,
    handleMethodCommit,
    getCancelProps,
    getConfirmProps,
    getAcknowledgementProps,
    cancelHighlighted,
    confirmHighlighted,
    acknowledgementHighlighted,
  } = useApiKeyDialogKeyboard({
    open,
    isHosted,
    method: entry.method,
    setMethod: entry.setMethod,
    canSubmit: canConfirm,
    isSubmitting: entry.isSubmitting,
    inputRef,
    acknowledgementRef,
    onSubmit: (method) => {
      void handleSubmit(method);
    },
    onClose: () => handleOpenChange(false),
  });

  const resetDialogState = useEffectEvent(() => {
    entry.reset();
    setNoticeAccepted(row.readiness.acknowledgement.status === "accepted");
  });

  useEffect(() => {
    if (!open) return;
    resetDialogState();
  }, [open]);

  const title = isUpdating ? "Update Configuration" : "Create Configuration";
  const layoutCopy = getSetupLayoutCopy(row, transportFamily);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-xl overflow-hidden"
        closeIcon={false}
        closeOnBackdropClick={!entry.isSubmitting}
        onEscapeKeyDown={(event) => {
          if (entry.isSubmitting) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {title} — {row.product.name}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <p className="text-sm text-muted-foreground leading-relaxed">{layoutCopy}</p>

          {isHosted ? (
            <ApiKeyMethodSelector
              value={entry.method}
              onChange={entry.setMethod}
              keyValue={entry.value}
              onKeyValueChange={entry.setValue}
              envVarName={envVarName}
              providerName={row.product.name}
              inputRef={inputRef}
              focused={focused}
              onFocus={setFocused}
              onKeySubmit={() => {
                void handleSubmit();
              }}
              onMethodCommit={handleMethodCommit}
              onInputMethodKeyDown={handleMethodKeyDown}
              getMethodOptionProps={getMethodOptionProps}
              invalid={entry.error !== null}
              errorId={errorId}
            />
          ) : null}

          <Checkbox
            ref={getAcknowledgementProps().ref}
            checked={noticeAccepted}
            onChange={setNoticeAccepted}
            onFocus={getAcknowledgementProps().onFocus}
            disabled={entry.isSubmitting}
            highlighted={acknowledgementHighlighted}
            value="accept-notice"
            label="Accept billing and privacy notice before saving"
            // Flush with the dialog body's content edge: the selectable row's own
            // horizontal padding pushed the consent line off the grid the prose sits on.
            className="px-0"
          />

          {entry.error && (
            <Callout id={errorId} tone="error" live>
              <Callout.Content>{entry.error}</Callout.Content>
            </Callout>
          )}

          {isHosted ? (
            <div className="text-xs text-muted-foreground border-t border-border/40 pt-3 leading-relaxed">
              Note: {storageNote}
            </div>
          ) : null}
        </DialogBody>

        <ApiKeyFooter
          onConfirm={() => {
            void handleSubmit();
          }}
          canSubmit={canConfirm}
          isSubmitting={entry.isSubmitting}
          getCancelProps={getCancelProps}
          getConfirmProps={getConfirmProps}
          cancelHighlighted={cancelHighlighted}
          confirmHighlighted={confirmHighlighted}
        />

        {/* Composed manually, last in DOM like the built-in one, so the submit gate that
            already blocks Escape and backdrop clicks is visible on the [x] too. */}
        <DialogCloseIcon disabled={entry.isSubmitting} />
      </DialogContent>
    </Dialog>
  );
}
