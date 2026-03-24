import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { RadioGroup } from "../../../components/ui/radio.js";

export function AgentExecutionScreen(): ReactElement {
  useScope("settings-agent-execution");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Enter", label: "Select" }] });
  useBackHandler();

  const [mode, setMode] = useState("parallel");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: call api.saveSettings({ executionMode: mode })
    setSaved(true);
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Agent Execution</SectionHeader>
          <Text dimColor>Current: {mode}</Text>
          <RadioGroup value={mode} onChange={setMode} isActive>
            <RadioGroup.Item
              value="parallel"
              label="Parallel"
              description="Run all agents concurrently (faster)"
            />
            <RadioGroup.Item
              value="sequential"
              label="Sequential"
              description="Run agents one at a time (lower resource usage)"
            />
          </RadioGroup>
          <Box gap={1}>
            <Button variant="primary" onPress={handleSave}>Save</Button>
          </Box>
          {saved && <Text color="green">Execution mode saved.</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
