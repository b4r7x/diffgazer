import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { AgentExecution } from "@diffgazer/schemas/config";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useSettings, useSaveSettings } from "@diffgazer/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Button } from "../../../components/ui/button.js";
import { RadioGroup } from "../../../components/ui/radio.js";

export function AgentExecutionScreen(): ReactElement {
  useScope("settings-agent-execution");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Enter", label: "Select" }] });
  useBackHandler();

  const { data: settings, isLoading, error: loadErrorObj } = useSettings();
  const loadError = loadErrorObj?.message ?? null;
  const saveSettings = useSaveSettings();
  const [mode, setMode] = useState<AgentExecution | null>(null);
  const [saved, setSaved] = useState(false);

  const isSaving = saveSettings.isPending;
  const saveError = saveSettings.error?.message ?? null;
  const current = mode ?? settings?.agentExecution ?? "parallel";

  function handleSave() {
    setSaved(false);
    saveSettings.mutate({ agentExecution: current }, {
      onSuccess: () => setSaved(true),
    });
  }

  if (isLoading) {
    return (
      <Panel>
        <Panel.Content>
          <Spinner label="Loading agent execution settings..." />
        </Panel.Content>
      </Panel>
    );
  }

  if (loadError) {
    return (
      <Panel>
        <Panel.Content>
          <Text color="red">{loadError}</Text>
        </Panel.Content>
      </Panel>
    );
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Agent Execution</SectionHeader>
          <Text dimColor>Current: {current}</Text>
          <RadioGroup value={current} onChange={(v) => { setMode(v as AgentExecution); setSaved(false); }} isActive={!isSaving}>
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
            <Button variant="primary" onPress={handleSave} loading={isSaving} disabled={isSaving}>Save</Button>
          </Box>
          {saved && <Text color="green">Execution mode saved.</Text>}
          {saveError && <Text color="red">{saveError}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
