import { useSaveConfig } from "@diffgazer/core/api/hooks";
import type { InputMethod } from "@diffgazer/core/onboarding";
import { useApiKeyEntry } from "@diffgazer/core/providers";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import {
  type AIProvider,
  type CredentialRef,
  PROVIDER_ENV_VARS,
} from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { ApiKeyMethodSelector } from "../../../components/shared/api-key-method-selector";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Spinner } from "../../../components/ui/spinner";
import { useActionRow } from "../../../hooks/use-action-row";
import { useTheme } from "../../../theme/provider";
import { isOverlayFooterNavActive } from "../lib/overlay-footer-gate";

interface ApiKeyOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: AIProvider;
  onSaved?: () => void;
}

export function ApiKeyOverlay({
  open,
  onOpenChange,
  providerId,
  onSaved,
}: ApiKeyOverlayProps): ReactElement | null {
  const { tokens } = useTheme();
  const saveConfig = useSaveConfig();
  const [inputFocused, setInputFocused] = useState(false);
  const envVarName = PROVIDER_ENV_VARS[providerId];

  const entry = useApiKeyEntry({
    envVarName,
    onSubmit: async (method, value) => {
      const credentialRef: CredentialRef =
        method === "env" ? { kind: "env", varName: value } : { kind: "literal", value };
      await saveConfig.mutateAsync({ provider: providerId, apiKey: credentialRef });
      onSaved?.();
      onOpenChange(false);
      return true;
    },
  });

  const { method, value, setMethod, setValue, canSubmit, isSubmitting: saving, error } = entry;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  function handleClose() {
    handleOpenChange(false);
  }

  function handleSave() {
    if (!canSubmit || saving) return;
    void entry.submit();
  }

  function handleMethodChange(m: InputMethod) {
    setMethod(m);
  }

  // Single Tab owner for the overlay: toggle the key input focus, which also
  // gates the footer arrows below (F-347b).
  useInput(
    (_input, key) => {
      if (key.tab && method === "paste") {
        setInputFocused((focused) => !focused);
        return;
      }
      if (key.return && inputFocused) handleSave();
    },
    { isActive: open && !saving },
  );

  const footerNavActive = isOverlayFooterNavActive({ open, saving, inputFocused });
  const actions = useActionRow({
    actionCount: 2,
    disabledActions: [!canSubmit, false],
    onAction: (index) => (index === 0 ? handleSave() : handleClose()),
    isActive: footerNavActive,
  });

  const resetSecrets = useEffectEvent(() => {
    if (entry.isSubmitting) return;
    entry.reset();
    actions.reset();
    setInputFocused(false);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: open/providerId are the reset triggers; useEffectEvent keeps the reset body current without depending on mutation object identity.
  useEffect(() => {
    resetSecrets();
  }, [open, providerId]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{`Configure API Key — ${providerId}`}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Box flexDirection="column" gap={1}>
            <Text color={tokens.muted}>Choose how to provide the API key for {providerId}:</Text>
            <ApiKeyMethodSelector
              method={method}
              onMethodChange={handleMethodChange}
              apiKey={value}
              onApiKeyChange={setValue}
              envVar={envVarName}
              envVarReadOnly
              isActive={open && !saving}
              inputFocused={inputFocused}
              onInputFocusedChange={setInputFocused}
            />
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
                  disabled={!canSubmit}
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
