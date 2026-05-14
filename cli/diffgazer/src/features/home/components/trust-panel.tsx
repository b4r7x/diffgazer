import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { Spinner } from "../../../components/ui/spinner.js";
import { useInit, useSaveTrust, guardQueryState } from "@diffgazer/core/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { CheckboxGroup } from "../../../components/ui/checkbox.js";
import { Callout } from "../../../components/ui/callout.js";

interface TrustPanelProps {
  onAccept: () => void;
}

export function TrustPanel({ onAccept }: TrustPanelProps): ReactElement {
  const initQuery = useInit();
  const saveTrust = useSaveTrust();
  const [checked, setChecked] = useState<string[]>(["readFiles"]);

  const saving = saveTrust.isPending;
  const error = saveTrust.error?.message ?? null;
  const hasRepoAccess = checked.includes("readFiles");

  const actionLabel = saving
    ? "Saving..."
    : hasRepoAccess
      ? "Trust & Continue"
      : "Continue Without Trust";

  function handleAccept() {
    if (!initQuery.data) return;
    saveTrust.mutate(
      {
        projectId: initQuery.data.project.projectId,
        repoRoot: initQuery.data.project.path,
        capabilities: {
          readFiles: checked.includes("readFiles"),
          runCommands: checked.includes("runCommands"),
        },
        trustMode: "persistent",
        trustedAt: new Date().toISOString(),
      },
      { onSuccess: () => onAccept() },
    );
  }

  const guard = guardQueryState(initQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Spinner label="Loading project info..." />
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
  });
  if (guard) return guard;

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Trust This Repository?</SectionHeader>
          <Text dimColor>Diffgazer needs permissions to review your code</Text>

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
            <Button variant="success" onPress={handleAccept} disabled={saving || !initQuery.data}>
              {actionLabel}
            </Button>
          </Box>
          {error && <Text color="red">{error}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
