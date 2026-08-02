import type { ProviderListRow, ProviderManagementOutcome } from "@diffgazer/core/providers";
import { useApiKeyEntry } from "@diffgazer/core/providers";
import type {
  ClientConfigurationInput,
  HostedApiProductId,
  LocalCliProductId,
  LocalHttpProductId,
  ReadinessAcknowledgement,
  SecretsStorage,
  WriteOnlySecretInput,
} from "@diffgazer/core/schemas/config";
import { Callout } from "@diffgazer/ui/components/callout";
import { Checkbox } from "@diffgazer/ui/components/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@diffgazer/ui/components/dialog";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { ApiKeyMethodSelector } from "@/components/shared/api-key-method-selector";
import { ApiKeyFooter } from "./footer";
import { useApiKeyDialogKeyboard } from "./use-keyboard";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;
type SetupTransportFamily = "hosted-api" | "local-http" | "local-cli";

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

function resolveSetupTransportFamily(row: ProviderListRow): SetupTransportFamily | null {
  if (row.configuration?.status === "supported") {
    return row.configuration.transportFamily;
  }
  if (row.product.status === "supported") {
    return row.product.transportFamily;
  }
  return null;
}

function requireSupportedProduct(
  row: ProviderListRow,
): Extract<ProviderListRow["product"], { status: "supported" }> {
  if (row.product.status !== "supported") {
    throw new Error("Setup requires a supported product");
  }
  return row.product;
}

function buildHostedInput(
  row: ProviderListRow,
  credential?: WriteOnlySecretInput,
): ClientConfigurationInput {
  const product = requireSupportedProduct(row);
  if (product.transportFamily !== "hosted-api") {
    throw new Error("Hosted setup requires a supported hosted-api product");
  }
  const endpoint =
    row.configuration?.status === "supported" && row.configuration.transportFamily === "hosted-api"
      ? row.configuration.endpoint
      : (product.endpoints[0]?.endpoint ?? "");
  return {
    transportFamily: "hosted-api",
    productId: product.productId as HostedApiProductId,
    endpoint,
    ...(credential ? { credential } : {}),
  };
}

function buildLocalHttpInput(row: ProviderListRow): ClientConfigurationInput {
  const product = requireSupportedProduct(row);
  const configured =
    row.configuration?.status === "supported" && row.configuration.transportFamily === "local-http"
      ? row.configuration
      : null;
  return {
    transportFamily: "local-http",
    productId: product.productId as LocalHttpProductId,
    endpoint: configured?.endpoint ?? product.endpoints[0]?.endpoint ?? "",
    authentication: "none",
    ...(configured?.presetId ? { presetId: configured.presetId } : {}),
  };
}

function buildLocalCliInput(row: ProviderListRow): ClientConfigurationInput {
  const product = requireSupportedProduct(row);
  const configured =
    row.configuration?.status === "supported" && row.configuration.transportFamily === "local-cli"
      ? row.configuration
      : null;
  return {
    transportFamily: "local-cli",
    productId: product.productId as LocalCliProductId,
    installationId: configured?.installationId ?? `${product.productId}-installation`,
  };
}

function buildAcknowledgement(row: ProviderListRow): AcceptedAcknowledgement {
  const notice = requireSupportedProduct(row).notice;
  return {
    status: "accepted",
    noticeId: notice.id,
    noticeVersion: notice.noticeVersion,
    acceptedAt: new Date().toISOString(),
  };
}

function toCredential(method: "paste" | "env", value: string): WriteOnlySecretInput {
  if (method === "env") return { kind: "environment" };
  return { kind: "literal", value };
}

function getLocalHttpCopy(row: ProviderListRow): string {
  if (resolveSetupTransportFamily(row) !== "local-http") {
    return "Local HTTP setup does not use API credentials.";
  }
  const product = row.product.status === "supported" ? row.product : null;
  const endpoint =
    row.configuration?.status === "supported" && row.configuration.transportFamily === "local-http"
      ? row.configuration.endpoint
      : product?.endpoints[0]?.endpoint;
  return `Configure the local endpoint at ${endpoint ?? "the selected loopback URL"} without storing hosted credentials.`;
}

function getLocalCliCopy(row: ProviderListRow): string {
  const family = resolveSetupTransportFamily(row);
  const productIsLocalCli =
    row.product.status === "supported" && row.product.transportFamily === "local-cli";
  if (family !== "local-cli" && !productIsLocalCli) {
    return "Local CLI setup does not use API credentials.";
  }
  return "Configure the local CLI installation without storing hosted credentials.";
}

function getLayoutCopy(
  row: ProviderListRow,
  isHosted: boolean,
  transportFamily: SetupTransportFamily | null,
): string {
  if (isHosted) {
    return `Choose how to provide credentials for ${row.product.name}:`;
  }
  if (transportFamily === "local-http") {
    return getLocalHttpCopy(row);
  }
  return getLocalCliCopy(row);
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

  const buildInput = (method: "paste" | "env", value: string): ClientConfigurationInput | null => {
    if (isHosted) return buildHostedInput(row, toCredential(method, value));
    if (transportFamily === "local-http") return buildLocalHttpInput(row);
    if (transportFamily === "local-cli") return buildLocalCliInput(row);
    return null;
  };

  // Every save family -- hosted credential, local HTTP, local CLI -- runs through
  // this one guarded machine, so a rejected save reports in place instead of
  // escaping the click handler as an unhandled rejection.
  const entry = useApiKeyEntry({
    onSubmit: async (method, value) => {
      if (!noticeAccepted) return false;
      const input = buildInput(method, value);
      if (!input) return false;

      const outcome =
        row.configuration?.status === "supported"
          ? await onUpdate(
              { input, acknowledgement: buildAcknowledgement(row) },
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
  const layoutCopy = getLayoutCopy(row, isHosted, transportFamily);

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
      </DialogContent>
    </Dialog>
  );
}
