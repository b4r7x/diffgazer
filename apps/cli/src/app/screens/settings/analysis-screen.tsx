import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { AnalysisSelector } from "../../../features/settings/components/analysis-selector.js";

export function AnalysisScreen(): ReactElement {
  useScope("settings-analysis");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Space", label: "Toggle" }] });
  useBackHandler();

  const [agents, setAgents] = useState(["security", "correctness"]);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: call api.saveSettings({ analysisAgents: agents })
    setSaved(true);
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Analysis Agents</SectionHeader>
          <Text dimColor>Select which agents run during review:</Text>
          <AnalysisSelector selectedAgents={agents} onChange={setAgents} isActive />
          <Box gap={1}>
            <Button variant="primary" onPress={handleSave}>Save</Button>
          </Box>
          {saved && <Text color="green">Analysis settings saved.</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
