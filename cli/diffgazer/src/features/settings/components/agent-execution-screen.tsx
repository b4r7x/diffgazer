import { guardQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { deriveSaveState } from "@diffgazer/core/forms";
import {
  AGENT_EXECUTION_OPTIONS,
  type AgentExecution,
  isAgentExecution,
} from "@diffgazer/core/schemas/config";
import {
  BACK_SHORTCUT,
  NAVIGATE_SHORTCUT,
  type Shortcut,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";
import { RadioGroup } from "../../../components/ui/radio";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useSettingsZone } from "../hooks/use-settings-zone.js";

const LIST_SHORTCUTS: Shortcut[] = [
  BACK_SHORTCUT,
  { key: "Tab", label: "Switch Zone" },
  NAVIGATE_SHORTCUT,
  { key: "Enter", label: "Select Mode" },
];

const BUTTON_SHORTCUTS: Shortcut[] = [
  BACK_SHORTCUT,
  { key: "Tab", label: "Switch Zone" },
  { key: "←/→", label: "Move Action" },
  { key: "Enter", label: "Activate" },
];

export function AgentExecutionScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
  useBackHandler();

  const { goBack } = useNavigation();
  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const [modeChoice, setModeChoice] = useState<AgentExecution | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSaving = saveSettings.isPending;
  const { effective: effectiveMode, canSave } = deriveSaveState<AgentExecution>({
    persisted: settingsQuery.data?.agentExecution,
    choice: modeChoice,
    saving: isSaving,
    fallback: "sequential",
  });

  const { isListActive, isButtonActive, zone } = useSettingsZone({
    buttonCount: 2,
    disabled: isSaving,
    disabledButtons: canSave ? undefined : [1],
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
              <Text dimColor>Choose whether analysis agents run in sequence or in parallel.</Text>
              <RadioGroup
                value={effectiveMode}
                onChange={handleModeChange}
                isActive={isListActive}
                disabled={isSaving}
              >
                {AGENT_EXECUTION_OPTIONS.map((option) => (
                  <RadioGroup.Item
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    description={option.description}
                  />
                ))}
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
