import { useSaveConfig } from "@diffgazer/core/api/hooks";
import type { AIProvider, CredentialRef } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { useTheme } from "../../../app/providers/theme";
import { ApiKeyMethodSelector } from "../../../components/shared/api-key-method-selector";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Spinner } from "../../../components/ui/spinner";

interface ApiKeyOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  onSave: (key: string, method: string) => void;
}

export function ApiKeyOverlay({
  open,
  onOpenChange,
  providerId,
  onSave,
}: ApiKeyOverlayProps): ReactElement | null {
  const { tokens } = useTheme();
  const saveConfig = useSaveConfig();
  const [method, setMethod] = useState<"paste" | "env">("paste");
  const [apiKey, setApiKey] = useState("");
  const [envVar, setEnvVar] = useState("");

  const saving = saveConfig.isPending;
  const error = saveConfig.error?.message ?? null;

  function handleSave() {
    const value = method === "paste" ? apiKey : envVar;
    if (!value || saving) return;

    const credentialRef: CredentialRef =
      method === "env"
        ? { kind: "env", varName: value }
        : { kind: "literal", value };

    saveConfig.mutate(
      { provider: providerId as AIProvider, apiKey: credentialRef },
      {
        onSuccess: () => {
          onSave(value, method);
          onOpenChange(false);
        },
      },
    );
  }

  function handleMethodChange(m: string) {
    if (m === "paste" || m === "env") {
      setMethod(m);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{`Configure API Key — ${providerId}`}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Box flexDirection="column" gap={1}>
            <Text color={tokens.muted}>
              Choose how to provide the API key for {providerId}:
            </Text>
            <ApiKeyMethodSelector
              method={method}
              onMethodChange={handleMethodChange}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              envVar={envVar}
              onEnvVarChange={setEnvVar}
              isActive={open && !saving}
            />
            {error != null ? (
              <Text color={tokens.error}>{error}</Text>
            ) : null}
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          <Box gap={1}>
            {saving ? (
              <Spinner label="Saving..." />
            ) : (
              <>
                <Button variant="primary" onPress={handleSave}>
                  Save
                </Button>
                <Button variant="ghost" onPress={() => onOpenChange(false)}>
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
