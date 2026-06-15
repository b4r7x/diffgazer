import { useSaveConfig } from "@diffgazer/core/api/hooks";
import type { InputMethod } from "@diffgazer/core/onboarding";
import { useApiKeyEntry } from "@diffgazer/core/providers";
import type { AIProvider, CredentialRef } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { ApiKeyMethodSelector } from "../../../components/shared/api-key-method-selector";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Spinner } from "../../../components/ui/spinner";
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
  const [footerIndex, setFooterIndex] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);

  const entry = useApiKeyEntry({
    onSubmit: async (method, value) => {
      const credentialRef: CredentialRef =
        method === "env" ? { kind: "env", varName: value } : { kind: "literal", value };
      await saveConfig.mutateAsync({ provider: providerId, apiKey: credentialRef });
      onSaved?.();
      onOpenChange(false);
    },
  });

  const { method, value, setMethod, setValue, canSubmit, error } = entry;
  const saving = saveConfig.isPending;

  const resetSecrets = useEffectEvent(() => {
    entry.reset();
    setFooterIndex(0);
    setInputFocused(false);
    saveConfig.reset();
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: open/providerId are the reset triggers; useEffectEvent keeps the reset body current without depending on mutation object identity.
  useEffect(() => {
    resetSecrets();
  }, [open, providerId]);

  function handleClose() {
    onOpenChange(false);
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
      if (key.tab) setInputFocused((focused) => !focused);
    },
    { isActive: open && !saving },
  );

  const footerNavActive = isOverlayFooterNavActive({ open, saving, inputFocused });
  useInput(
    (_input, key) => {
      if (key.leftArrow) {
        setFooterIndex((index) => Math.max(0, index - 1));
        return;
      }
      if (key.rightArrow) {
        setFooterIndex((index) => Math.min(1, index + 1));
      }
    },
    { isActive: footerNavActive },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              envVar={value}
              onEnvVarChange={setValue}
              isActive={open && !saving}
              inputFocused={inputFocused}
              onInputFocusedChange={setInputFocused}
            />
            {error != null ? <Text color={tokens.error}>{error}</Text> : null}
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          <Box gap={1}>
            {saving ? (
              <Spinner label="Saving..." />
            ) : (
              <>
                <Button variant="primary" onPress={handleSave} isActive={footerIndex === 0}>
                  Save
                </Button>
                <Button variant="ghost" onPress={handleClose} isActive={footerIndex === 1}>
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
