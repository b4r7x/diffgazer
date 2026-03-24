import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { ThemeSelector } from "../../../features/settings/components/theme-selector.js";

export function ThemeScreen(): ReactElement {
  useScope("settings-theme");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Enter", label: "Select" }] });
  useBackHandler();

  const [theme, setTheme] = useState("dark");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: call api.saveSettings({ theme })
    setSaved(true);
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Theme</SectionHeader>
          <Text dimColor>Current: {theme}</Text>
          <ThemeSelector value={theme} onChange={setTheme} isActive />
          <Box gap={1}>
            <Button variant="primary" onPress={handleSave}>Save</Button>
          </Box>
          {saved && <Text color="green">Theme saved.</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
