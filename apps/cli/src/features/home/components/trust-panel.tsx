import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { CheckboxGroup } from "../../../components/ui/checkbox.js";
import { Callout } from "../../../components/ui/callout.js";

interface TrustPanelProps {
  onAccept: (caps: { readFiles: boolean; runCommands: boolean }) => void;
}

export function TrustPanel({ onAccept }: TrustPanelProps): ReactElement {
  const [checked, setChecked] = useState<string[]>([]);

  function handleAccept() {
    onAccept({
      readFiles: checked.includes("readFiles"),
      runCommands: checked.includes("runCommands"),
    });
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Trust This Project</SectionHeader>

          <Callout variant="warning">
            <Callout.Title>First-Time Setup</Callout.Title>
            <Callout.Content>
              Grant permissions so the AI reviewer can analyze your code. You can change these later in Settings.
            </Callout.Content>
          </Callout>

          <Text dimColor>Select capabilities to grant:</Text>

          <CheckboxGroup value={checked} onChange={setChecked} isActive>
            <CheckboxGroup.Item
              value="readFiles"
              label="Read files"
              description="Allow reading project files for context"
            />
            <CheckboxGroup.Item
              value="runCommands"
              label="Run commands"
              description="Allow running shell commands (e.g., lint, test)"
            />
          </CheckboxGroup>

          <Box gap={1}>
            <Button variant="success" onPress={handleAccept}>Accept & Continue</Button>
          </Box>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
