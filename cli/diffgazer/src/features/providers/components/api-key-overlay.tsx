import { usePageFooter } from "@diffgazer/core/footer";
import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  buildSetupAcknowledgement,
  buildSetupInput,
  getSetupLayoutCopy,
  requiresExplicitModelSelection,
  resolveCredentialEnvironmentVariable,
  toSetupCredential,
} from "@diffgazer/core/providers";
import { useApiKeyEntry } from "@diffgazer/core/providers/hooks";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
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
  { key: "←/→", label: "Switch Action" },
  { key: "Enter", label: "Confirm" },
];
// Only hosted rows render a key field, so only they can offer the Tab focus swap.
const HOSTED_KEY_FIELD_SHORTCUT: Shortcut = { key: "Tab", label: "Focus Key Field" };
const ACCEPT_SHORTCUT: Shortcut = { key: "a", label: "Accept" };
const SETUP_RIGHT_SHORTCUTS: Shortcut[] = [{ ...BACK_SHORTCUT, label: "Close" }];

interface ApiKeyOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ProviderListRow;
  onCreate: (
    input: ClientConfigurationInput,
    opts: {
      acknowledgement: AcceptedAcknowledgement;
      openModelDialog?: boolean;
    },
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
  // The provider consent is gated before this overlay opens and covers every
  // product notice; an explicit acceptance is asked for only when this
  // product's notice needs accepting again (a notice bump, or a record upgraded
  // without an acceptance).
  const needsAcceptance = row.readiness.acknowledgement.status === "required";
  const [accepted, setAccepted] = useState(false);
  const acknowledged = !needsAcceptance || accepted;
  const isHosted = row.product.transportFamily === "hosted-api";
  const isUpdating = row.configuration != null;

  const entry = useApiKeyEntry({
    onSubmit: async (method, value) => {
      if (!acknowledged) return false;
      const input = buildSetupInput(row, toSetupCredential(method, value));
      const acknowledgement = buildSetupAcknowledgement(row);
      const openModelDialog = requiresExplicitModelSelection(row.product.productId);
      if (row.configuration) {
        await onUpdate({ input, acknowledgement }, { openModelDialog });
      } else {
        await onCreate(input, { acknowledgement, openModelDialog });
      }
      onOpenChange(false);
      return true;
    },
  });

  const { method, value, setMethod, setValue, canSubmit, isSubmitting: saving, error } = entry;
  const canConfirm = isHosted ? canSubmit && acknowledged : acknowledged;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  function handleClose() {
    handleOpenChange(false);
  }

  function handleSave() {
    if (!canConfirm || saving) return;
    if (isHosted) {
      void entry.submit();
      return;
    }
    void entry.submitCredentialless();
  }

  useInput(
    (input) => {
      if (input === "a") setAccepted((current) => !current);
    },
    { isActive: open && !saving && !inputFocused && needsAcceptance },
  );

  useInput(
    (_input, key) => {
      if (key.tab && isHosted && method === "paste") {
        setInputFocused((focused) => !focused);
        return;
      }
      if (key.return && inputFocused) handleSave();
    },
    { isActive: open && !saving },
  );

  usePageFooter({
    shortcuts: [
      ...(isHosted ? [HOSTED_KEY_FIELD_SHORTCUT] : []),
      ...SETUP_SHORTCUTS,
      ...(needsAcceptance ? [ACCEPT_SHORTCUT] : []),
    ],
    rightShortcuts: SETUP_RIGHT_SHORTCUTS,
  });

  const actions = useActionRow({
    actionCount: 2,
    disabledActions: [!canConfirm, false],
    onAction: (index) => (index === 0 ? handleSave() : handleClose()),
    isActive: open && !saving && !inputFocused && (isHosted || acknowledged),
  });
  const acceptButtonActive = open && !saving && !isHosted && needsAcceptance && !accepted;

  const resetSecrets = useEffectEvent(() => {
    if (entry.isSubmitting) return;
    entry.reset();
    actions.reset();
    setInputFocused(false);
    setAccepted(false);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: open/row identity are reset triggers.
  useEffect(() => {
    resetSecrets();
  }, [open, row.product.productId, row.configuration?.configurationId]);

  const title = isUpdating ? "Update Configuration" : "Create Configuration";
  const layoutCopy = getSetupLayoutCopy(row);

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
                envVar={resolveCredentialEnvironmentVariable(row.product.productId)}
                envVarReadOnly
                isActive={open && !saving}
                inputFocused={inputFocused}
                onInputFocusedChange={setInputFocused}
              />
            ) : null}
            <Box flexDirection="column">
              {[...row.product.notice.billing, ...row.product.notice.privacy].map((line) => (
                <Text key={line} color={tokens.muted}>
                  {line}
                </Text>
              ))}
            </Box>
            {needsAcceptance ? (
              <>
                <Text>This product's notice needs your acceptance before saving.</Text>
                <Text color={tokens.muted}>{accepted ? "[x]" : "[ ]"} I accept</Text>
                <Button
                  variant="secondary"
                  isActive={acceptButtonActive}
                  onPress={() => setAccepted((current) => !current)}
                  disabled={saving}
                >
                  {accepted ? "Accepted" : "Accept"}
                </Button>
              </>
            ) : null}
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
                  disabled={!canConfirm}
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
