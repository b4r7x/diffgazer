import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useInit, useSaveTrust, matchQueryState } from "@diffgazer/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { CheckboxGroup } from "../../../components/ui/checkbox.js";
import { Callout } from "../../../components/ui/callout.js";

interface TrustPanelProps {
  onAccept: (caps: { readFiles: boolean; runCommands: boolean }) => void;
}

export function TrustPanel({ onAccept }: TrustPanelProps): ReactElement {
  const initQuery = useInit();
  const saveTrust = useSaveTrust();
  const [checked, setChecked] = useState<string[]>([]);

  const saving = saveTrust.isPending;
  const error = saveTrust.error?.message ?? null;

  function handleAccept() {
    if (!initQuery.data) return;
    const capabilities = {
      readFiles: checked.includes("readFiles"),
      runCommands: checked.includes("runCommands"),
    };
    saveTrust.mutate(
      {
        projectId: initQuery.data.project.projectId,
        repoRoot: initQuery.data.project.path,
        capabilities,
        trustMode: "persistent",
        trustedAt: new Date().toISOString(),
      },
      { onSuccess: () => onAccept(capabilities) },
    );
  }

  const guard = matchQueryState(initQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Box gap={1}>
            <Spinner type="dots" />
            <Text>Loading project info...</Text>
          </Box>
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
  if (guard) return guard;

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
            <Button variant="success" onPress={handleAccept} disabled={saving}>
              {saving ? "Saving..." : "Accept & Continue"}
            </Button>
          </Box>
          {error && <Text color="red">{error}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
