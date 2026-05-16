import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { AgentExecution } from "@diffgazer/core/schemas/config";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "@diffgazer/core/footer";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useNavigation } from "../../navigation-context.js";
import { useSettingsZone } from "../../../hooks/use-settings-zone.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { useSettings, useSaveSettings, guardQueryState } from "@diffgazer/core/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Button } from "../../../components/ui/button.js";
import { RadioGroup } from "../../../components/ui/radio.js";

const EXECUTION_MODES: AgentExecution[] = ["sequential", "parallel"];

const LIST_SHORTCUTS = [
  { key: "Esc", label: "Back" },
  { key: "Tab", label: "Switch Zone" },
  { key: "↑/↓", label: "Navigate" },
  { key: "Enter", label: "Select Mode" },
] as const;

const BUTTON_SHORTCUTS = [
  { key: "Esc", label: "Back" },
  { key: "Tab", label: "Switch Zone" },
  { key: "←/→", label: "Move Action" },
  { key: "Enter", label: "Activate" },
] as const;

function isAgentExecution(value: string): value is AgentExecution {
  return EXECUTION_MODES.some((mode) => mode === value);
}

export function AgentExecutionScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
  useScope("settings-agent-execution");
  useBackHandler();

  const { goBack } = useNavigation();
  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const [modeChoice, setModeChoice] = useState<AgentExecution | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSaving = saveSettings.isPending;
  const persistedMode = settingsQuery.data?.agentExecution ?? "sequential";
  const effectiveMode = modeChoice ?? persistedMode;
  const isDirty = modeChoice !== null && modeChoice !== persistedMode;
  const canSave = !isSaving && isDirty;

  const { isListActive, isButtonActive, zone } = useSettingsZone({
    buttonCount: 2,
    disabled: isSaving,
  });

  usePageFooter({
    shortcuts: zone === "buttons" ? [...BUTTON_SHORTCUTS] : [...LIST_SHORTCUTS],
  });

  function handleModeChange(value: string) {
    if (!isAgentExecution(value)) return;
    setModeChoice(value);
    setError(null);
  }

  function handleSave() {
    if (!canSave) return;
    setError(null);
    saveSettings.mutate(
      { agentExecution: effectiveMode },
      {
        onSuccess: () => {
          setModeChoice(null);
          goBack();
        },
        onError: (err) => {
          setError(err.message);
        },
      },
    );
  }

  const guard = guardQueryState(settingsQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Spinner label="Loading agent execution settings..." />
        </Panel.Content>
      </Panel>
    ),
    error: (err) => (
      <Panel>
        <Panel.Content>
          <Text color="red">{err.message}</Text>
        </Panel.Content>
      </Panel>
    ),
  });

  if (guard) return guard;

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 60)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={1}>
              <SectionHeader>Agent Execution Mode</SectionHeader>
              <Text dimColor>
                Choose whether analysis agents run in sequence or in parallel.
              </Text>
              <RadioGroup
                value={effectiveMode}
                onChange={handleModeChange}
                isActive={isListActive}
                disabled={isSaving}
              >
                <RadioGroup.Item
                  value="sequential"
                  label="Sequential"
                  description="Agents run one after another. Works with all providers and tiers."
                />
                <RadioGroup.Item
                  value="parallel"
                  label="Parallel"
                  description="All agents run at once. Faster, but may hit rate limits on free tiers."
                />
              </RadioGroup>
              <Box gap={1}>
                <Button
                  variant="ghost"
                  onPress={goBack}
                  disabled={isSaving}
                  isActive={isButtonActive(0)}
                >
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onPress={handleSave}
                  disabled={!canSave}
                  isActive={isButtonActive(1)}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </Box>
              {error && <Text color="red">{error}</Text>}
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
