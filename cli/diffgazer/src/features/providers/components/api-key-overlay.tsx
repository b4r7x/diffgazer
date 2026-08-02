import { usePageFooter } from "@diffgazer/core/footer";
import type { ProviderListRow } from "@diffgazer/core/providers";
import { useApiKeyEntry } from "@diffgazer/core/providers";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import type {
  ClientConfigurationInput,
  HostedApiProductId,
  LocalCliProductId,
  LocalHttpProductId,
  ReadinessAcknowledgement,
  WriteOnlySecretInput,
} from "@diffgazer/core/schemas/config";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { ApiKeyMethodSelector } from "../../../components/shared/api-key-method-selector";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Spinner } from "../../../components/ui/spinner";
import { useActionRow } from "../../../hooks/use-action-row";
import { useTheme } from "../../../theme/provider";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;

const SETUP_SHORTCUTS: Shortcut[] = [
  { key: "Tab", label: "Focus Key Field" },
  { key: "←/→", label: "Switch Action" },
  { key: "Enter", label: "Confirm" },
];
const SETUP_RIGHT_SHORTCUTS: Shortcut[] = [{ ...BACK_SHORTCUT, label: "Close" }];

interface ApiKeyOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ProviderListRow;
  onCreate: (
    input: ClientConfigurationInput,
    opts?: { openModelDialog?: boolean },
  ) => Promise<void>;
  onUpdate: (
    input: {
      input: ClientConfigurationInput;
      acknowledgement: AcceptedAcknowledgement;
    },
    opts?: { openModelDialog?: boolean },
  ) => Promise<void>;
}

type SetupTransportFamily = "hosted-api" | "local-http" | "local-cli";
type SupportedProviderProduct = Extract<ProviderListRow["product"], { status: "supported" }>;

function getSupportedProduct(row: ProviderListRow): SupportedProviderProduct {
  if (row.product.status !== "supported") {
    throw new Error(`Product ${row.product.productId} is not supported for setup`);
  }
  return row.product;
}

function getProductNotice(row: ProviderListRow) {
  if (row.product.status === "supported") {
    return row.product.notice;
  }
  const notice = row.notices[0];
  if (!notice) {
    throw new Error(`Missing notice for product ${row.product.productId}`);
  }
  return notice;
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

function buildHostedInput(
  row: ProviderListRow,
  credential?: WriteOnlySecretInput,
): ClientConfigurationInput {
  const product = getSupportedProduct(row);
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

function buildAcknowledgement(row: ProviderListRow): AcceptedAcknowledgement {
  const notice = getProductNotice(row);
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
  let endpoint: string | undefined;
  if (
    row.configuration?.status === "supported" &&
    row.configuration.transportFamily === "local-http"
  ) {
    endpoint = row.configuration.endpoint;
  } else if (product?.transportFamily === "local-http") {
    endpoint = product.endpoints[0]?.endpoint;
  }
  return `Configure the local endpoint at ${endpoint ?? "the selected loopback URL"} without storing hosted credentials.`;
}

function getLayoutCopy(
  row: ProviderListRow,
  isHosted: boolean,
  transportFamily: ReturnType<typeof resolveSetupTransportFamily>,
): string {
  if (isHosted) {
    return `Choose how to provide credentials for ${row.product.name}:`;
  }
  if (transportFamily === "local-http") {
    return getLocalHttpCopy(row);
  }
  return getLocalCliCopy(row);
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

export function ApiKeyOverlay({
  open,
  onOpenChange,
  row,
  onCreate,
  onUpdate,
}: ApiKeyOverlayProps): ReactElement | null {
  const { tokens } = useTheme();
  const [inputFocused, setInputFocused] = useState(false);
  const [noticeAccepted, setNoticeAccepted] = useState(
    () =>
      row.readiness.acknowledgement.status === "accepted" ||
      row.readiness.acknowledgement.status === "not-applicable",
  );
  const transportFamily = resolveSetupTransportFamily(row);
  const isHosted = transportFamily === "hosted-api";
  const isUpdating =
    row.configuration?.status === "supported" || row.configuration?.status === "removed";

  const entry = useApiKeyEntry({
    onSubmit: async (method, value) => {
      const credential = toCredential(method, value);
      const input = buildHostedInput(row, credential);
      const acknowledgement = buildAcknowledgement(row);
      if (row.configuration?.status === "supported") {
        await onUpdate(
          { input, acknowledgement },
          {
            openModelDialog: row.product.productId === "openrouter",
          },
        );
      } else {
        await onCreate(input, { openModelDialog: row.product.productId === "openrouter" });
      }
      onOpenChange(false);
      return true;
    },
  });

  const { method, value, setMethod, setValue, canSubmit, isSubmitting: saving, error } = entry;
  const canConfirmHosted = canSubmit && noticeAccepted;

  async function handleLocalSave() {
    if (!noticeAccepted || saving) return;
    const acknowledgement = buildAcknowledgement(row);
    if (transportFamily === "local-http") {
      const product = getSupportedProduct(row);
      if (product.transportFamily !== "local-http") {
        throw new Error("Local HTTP setup requires a supported local-http product");
      }
      const endpoint =
        row.configuration?.status === "supported" &&
        row.configuration.transportFamily === "local-http"
          ? row.configuration.endpoint
          : product.endpoints[0]?.endpoint;
      const input: Extract<ClientConfigurationInput, { transportFamily: "local-http" }> = {
        transportFamily: "local-http",
        productId: product.productId as LocalHttpProductId,
        endpoint: endpoint ?? "",
        authentication: "none",
        presetId:
          row.configuration?.status === "supported" &&
          row.configuration.transportFamily === "local-http"
            ? (row.configuration.presetId ?? undefined)
            : undefined,
      };
      if (row.configuration?.status === "supported") {
        await onUpdate({ input, acknowledgement });
      } else {
        await onCreate(input);
      }
      onOpenChange(false);
      return;
    }
    if (transportFamily === "local-cli") {
      const product = getSupportedProduct(row);
      if (product.transportFamily !== "local-cli") {
        throw new Error("Local CLI setup requires a supported local-cli product");
      }
      const installationId =
        row.configuration?.status === "supported" &&
        row.configuration.transportFamily === "local-cli"
          ? row.configuration.installationId
          : `${product.productId}-installation`;
      const input: Extract<ClientConfigurationInput, { transportFamily: "local-cli" }> = {
        transportFamily: "local-cli",
        productId: product.productId as LocalCliProductId,
        installationId: installationId ?? "",
      };
      if (row.configuration?.status === "supported") {
        await onUpdate({ input, acknowledgement });
      } else {
        await onCreate(input);
      }
      onOpenChange(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  function handleClose() {
    handleOpenChange(false);
  }

  function handleSave() {
    if (isHosted) {
      if (!canConfirmHosted || saving) return;
      void entry.submit();
      return;
    }
    void handleLocalSave();
  }

  useInput(
    (input) => {
      if (input === "a" && !saving) {
        setNoticeAccepted((accepted) => !accepted);
      }
    },
    { isActive: open && !saving },
  );

  useInput(
    (_input, key) => {
      if (key.tab && isHosted && method === "paste") {
        setInputFocused((focused) => !focused);
        return;
      }
      if (key.return && (inputFocused || !isHosted)) handleSave();
    },
    { isActive: open && !saving },
  );

  usePageFooter({
    shortcuts: SETUP_SHORTCUTS,
    rightShortcuts: SETUP_RIGHT_SHORTCUTS,
  });

  const actions = useActionRow({
    actionCount: 2,
    disabledActions: [isHosted ? !canConfirmHosted : !noticeAccepted, false],
    onAction: (index) => (index === 0 ? handleSave() : handleClose()),
    isActive: open && !saving && !inputFocused,
  });

  const resetSecrets = useEffectEvent(() => {
    if (entry.isSubmitting) return;
    entry.reset();
    actions.reset();
    setInputFocused(false);
    setNoticeAccepted(false);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: open/row identity are reset triggers.
  useEffect(() => {
    resetSecrets();
  }, [open, row.product.productId, row.configuration?.configurationId]);

  const title = isUpdating ? "Update Configuration" : "Create Configuration";
  const layoutCopy = getLayoutCopy(row, isHosted, transportFamily);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{`${title} — ${row.product.name}`}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Box flexDirection="column" gap={1}>
            <Text color={tokens.muted}>{layoutCopy}</Text>
            {isHosted ? (
              <ApiKeyMethodSelector
                method={method}
                onMethodChange={setMethod}
                apiKey={value}
                onApiKeyChange={setValue}
                envVar=""
                envVarReadOnly
                isActive={open && !saving}
                inputFocused={inputFocused}
                onInputFocusedChange={setInputFocused}
              />
            ) : null}
            <Text color={tokens.muted}>
              {noticeAccepted ? "[x]" : "[ ]"} Accept billing and privacy notice before saving.
            </Text>
            <Button
              variant="secondary"
              isActive={false}
              onPress={() => setNoticeAccepted((accepted) => !accepted)}
              disabled={saving}
            >
              {noticeAccepted ? "Notice accepted" : "Accept notice"}
            </Button>
            {error != null ? <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text> : null}
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          <Box gap={1}>
            {saving ? (
              <Spinner label="Saving..." />
            ) : (
              <>
                <Button
                  variant="primary"
                  onPress={() => actions.activate(0)}
                  isActive={actions.isActionActive(0)}
                  disabled={isHosted ? !canConfirmHosted : !noticeAccepted}
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => actions.activate(1)}
                  isActive={actions.isActionActive(1)}
                >
                  Cancel
                </Button>
              </>
            )}
          </Box>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
