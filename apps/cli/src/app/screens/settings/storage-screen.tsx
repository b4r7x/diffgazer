import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { SecretsStorage } from "@diffgazer/schemas/config";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useSettings } from "../../../hooks/use-settings.js";
import { api } from "../../../lib/api.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { StorageSelector } from "../../../features/settings/components/storage-selector.js";

export function StorageScreen(): ReactElement {
  useScope("settings-storage");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Enter", label: "Select" }] });
  useBackHandler();

  const { settings, isLoading, error } = useSettings();
  const [storage, setStorage] = useState<SecretsStorage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const effectiveStorage = storage ?? settings?.secretsStorage ?? "file";

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await api.saveSettings({ secretsStorage: effectiveStorage });
      setSaveMessage("Storage setting saved.");
      setStorage(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save storage setting");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Panel>
        <Panel.Content>
          <Box gap={1}>
            <Spinner type="dots" />
            <Text>Loading storage settings...</Text>
          </Box>
        </Panel.Content>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        <Panel.Content>
          <Text color="red">Error: {error}</Text>
        </Panel.Content>
      </Panel>
    );
  }

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
