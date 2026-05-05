import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { useTheme } from "../../../theme/theme-context.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { useSaveConfig } from "@diffgazer/core/api/hooks";
import { ApiKeyMethodSelector } from "./api-key-method-selector.js";

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

    saveConfig.mutate(
      { provider: providerId as AIProvider, apiKey: value },
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
