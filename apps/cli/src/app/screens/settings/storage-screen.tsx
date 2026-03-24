import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { StorageSelector } from "../../../features/settings/components/storage-selector.js";

export function StorageScreen(): ReactElement {
  useScope("settings-storage");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Enter", label: "Select" }] });
  useBackHandler();

  const [storage, setStorage] = useState("file");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: call api.saveSettings({ secretsStorage: storage })
    setSaved(true);
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Secrets Storage</SectionHeader>
          <Text dimColor>Current: {storage}</Text>
          <StorageSelector value={storage} onChange={setStorage} isActive />
          <Box gap={1}>
            <Button variant="primary" onPress={handleSave}>Save</Button>
          </Box>
          {saved && <Text color="green">Storage setting saved.</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
