import { useSaveConfig } from "@diffgazer/core/api/hooks";
import type { AIProvider, CredentialRef } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { ApiKeyMethodSelector } from "../../../components/shared/api-key-method-selector";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Spinner } from "../../../components/ui/spinner";
import { useTheme } from "../../../theme/provider";

interface ApiKeyOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
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
  const [method, setMethod] = useState<"paste" | "env">("paste");
  const [apiKey, setApiKey] = useState("");
  const [envVar, setEnvVar] = useState("");
  const [footerIndex, setFooterIndex] = useState(0);

  const saving = saveConfig.isPending;
  const error = saveConfig.error?.message ?? null;

  const resetSecrets = useEffectEvent(() => {
    setMethod("paste");
    setApiKey("");
    setEnvVar("");
    setFooterIndex(0);
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
    const value = method === "paste" ? apiKey : envVar;
    if (!value || saving) return;

    const credentialRef: CredentialRef =
      method === "env" ? { kind: "env", varName: value } : { kind: "literal", value };

    saveConfig.mutate(
      { provider: providerId as AIProvider, apiKey: credentialRef },
      {
        onSuccess: () => {
          onSaved?.();
          handleClose();
        },
      },
    );
  }

  function handleMethodChange(m: string) {
    if (m === "paste" || m === "env") {
      setMethod(m);
    }
  }

  useInput(
    (_input, key) => {
      if (saving) return;
      if (key.leftArrow) {
        setFooterIndex((index) => Math.max(0, index - 1));
        return;
      }
      if (key.rightArrow) {
        setFooterIndex((index) => Math.min(1, index + 1));
      }
    },
    { isActive: open && !saving },
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
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              envVar={envVar}
              onEnvVarChange={setEnvVar}
              isActive={open && !saving}
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
