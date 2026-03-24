import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useInit, useSaveTrust } from "@diffgazer/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { CheckboxGroup } from "../../../components/ui/checkbox.js";
import { Callout } from "../../../components/ui/callout.js";

interface TrustPanelProps {
  onAccept: (caps: { readFiles: boolean; runCommands: boolean }) => void;
}

export function TrustPanel({ onAccept }: TrustPanelProps): ReactElement {
  const { data: initData, isLoading: initLoading, error: initErrorObj } = useInit();
  const initError = initErrorObj?.message ?? null;
  const saveTrust = useSaveTrust();
  const [checked, setChecked] = useState<string[]>([]);

  const saving = saveTrust.isPending;
  const error = saveTrust.error?.message ?? null;

  function handleAccept() {
    if (!initData) return;
    const capabilities = {
      readFiles: checked.includes("readFiles"),
      runCommands: checked.includes("runCommands"),
    };
    saveTrust.mutate(
      {
        projectId: initData.project.projectId,
        repoRoot: initData.project.path,
        capabilities,
        trustMode: "persistent",
        trustedAt: new Date().toISOString(),
      },
      { onSuccess: () => onAccept(capabilities) },
    );
  }

  if (initLoading) {
    return (
      <Panel>
        <Panel.Content>
          <Box gap={1}>
            <Spinner type="dots" />
            <Text>Loading project info...</Text>
          </Box>
        </Panel.Content>
      </Panel>
    );
  }

  if (initError) {
    return (
      <Panel>
        <Panel.Content>
          <Text color="red">Error: {initError}</Text>
        </Panel.Content>
      </Panel>
    );
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

          <CheckboxGroup value={checked} onChange={setChecked} isActive={!saving}>
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
            <Button variant="success" onPress={handleAccept} disabled={saving || !initData}>
              {saving ? "Saving..." : "Accept & Continue"}
            </Button>
          </Box>
          {error && <Text color="red">{error}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
