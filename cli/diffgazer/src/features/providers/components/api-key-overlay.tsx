import { usePageFooter } from "@diffgazer/core/footer";
import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  buildSetupAcknowledgement,
  buildSetupInput,
  getSetupLayoutCopy,
  resolveSetupTransportFamily,
  toSetupCredential,
  useApiKeyEntry,
} from "@diffgazer/core/providers";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import type {
  ClientConfigurationInput,
  ReadinessAcknowledgement,
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

export function ApiKeyOverlay({
  open,
  onOpenChange,
  row,
  onCreate,
  onUpdate,
}: ApiKeyOverlayProps): ReactElement | null {
  const { tokens } = useTheme();
  const [inputFocused, setInputFocused] = useState(false);
  // Only a stored acceptance pre-checks the notice: `not-applicable` means the row carries no
  // acknowledgement yet (unconfigured or removed), so consent is still outstanding.
  const [noticeAccepted, setNoticeAccepted] = useState(
    () => row.readiness.acknowledgement.status === "accepted",
  );
  const transportFamily = resolveSetupTransportFamily(row);
  const isHosted = transportFamily === "hosted-api";
  const isUpdating =
    row.configuration?.status === "supported" || row.configuration?.status === "removed";

  const entry = useApiKeyEntry({
    onSubmit: async (method, value) => {
      const input = buildSetupInput(row, transportFamily, toSetupCredential(method, value));
      if (!input) return false;
      const acknowledgement = buildSetupAcknowledgement(row);
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
    if (transportFamily !== "local-http" && transportFamily !== "local-cli") return;

    const input = buildSetupInput(row, transportFamily);
    if (!input) return;
    const acknowledgement = buildSetupAcknowledgement(row);
    if (row.configuration?.status === "supported") {
      await onUpdate({ input, acknowledgement });
    } else {
      await onCreate(input);
    }
    onOpenChange(false);
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
    setNoticeAccepted(row.readiness.acknowledgement.status === "accepted");
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: open/row identity are reset triggers.
  useEffect(() => {
    resetSecrets();
  }, [open, row.product.productId, row.configuration?.configurationId]);

  const title = isUpdating ? "Update Configuration" : "Create Configuration";
  const layoutCopy = getSetupLayoutCopy(row, transportFamily);

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
