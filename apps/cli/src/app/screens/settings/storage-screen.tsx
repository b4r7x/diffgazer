import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { SecretsStorage } from "@diffgazer/schemas/config";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useSettings, useSaveSettings, matchQueryState } from "@diffgazer/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Button } from "../../../components/ui/button.js";
import { StorageSelector } from "../../../features/settings/components/storage-selector.js";

export function StorageScreen(): ReactElement {
  useScope("settings-storage");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Enter", label: "Select" }] });
  useBackHandler();

  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const [storage, setStorage] = useState<SecretsStorage | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const saving = saveSettings.isPending;
  const saveError = saveSettings.error?.message ?? null;
  const effectiveStorage = storage ?? settingsQuery.data?.secretsStorage ?? "file";

  function handleSave() {
    setSaveMessage(null);
    saveSettings.mutate({ secretsStorage: effectiveStorage }, {
      onSuccess: () => {
        setSaveMessage("Storage setting saved.");
        setStorage(null);
      },
    });
  }

  const guard = matchQueryState(settingsQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Spinner label="Loading storage settings..." />
        </Panel.Content>
      </Panel>
    ),
    error: (err) => (
      <Panel>
        <Panel.Content>
          <Text color="red">Error: {err.message}</Text>
        </Panel.Content>
      </Panel>
    ),
    success: () => null,
  });

  if (guard) return guard as ReactElement;

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Secrets Storage</SectionHeader>
          <Text dimColor>Current: {effectiveStorage}</Text>
          <StorageSelector value={effectiveStorage} onChange={(v) => setStorage(v as SecretsStorage)} isActive={!saving} />
          <Box gap={1}>
            <Button variant="primary" onPress={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </Box>
          {saveMessage && <Text color="green">{saveMessage}</Text>}
          {saveError && <Text color="red">{saveError}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
