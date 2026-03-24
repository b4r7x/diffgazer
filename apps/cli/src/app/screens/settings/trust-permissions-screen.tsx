import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { TrustPermissionsContent } from "../../../features/settings/components/trust-permissions-content.js";

interface Capabilities {
  readFiles: boolean;
  runCommands: boolean;
}

export function TrustPermissionsScreen(): ReactElement {
  useScope("trust-form");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Space", label: "Toggle" }] });
  useBackHandler();

  const [capabilities, setCapabilities] = useState<Capabilities>({
    readFiles: false,
    runCommands: false,
  });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: call api.saveSettings({ trust: capabilities })
    setSaved(true);
  }

  function handleRevoke() {
    setCapabilities({ readFiles: false, runCommands: false });
    setSaved(false);
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Trust & Permissions</SectionHeader>
          <TrustPermissionsContent
            capabilities={capabilities}
            onChange={setCapabilities}
            isActive
          />
          <Box gap={1}>
            <Button variant="primary" onPress={handleSave}>Save</Button>
            <Button variant="destructive" onPress={handleRevoke}>Revoke All</Button>
          </Box>
          {saved && <Text color="green">Trust permissions saved.</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
