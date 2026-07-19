import { guardQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { deriveSaveState } from "@diffgazer/core/forms";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import {
  AGENT_EXECUTION_OPTIONS,
  type AgentExecution,
  isAgentExecution,
} from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { useQueryGuardPanels } from "../../../components/shared/query-guard-panels";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";
import { RadioGroup } from "../../../components/ui/radio";
import { SectionHeader } from "../../../components/ui/section-header";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { getSettingsFooter, useSettingsZone } from "../hooks/use-settings-zone";

const LIST_SHORTCUTS: Shortcut[] = [NAVIGATE_SHORTCUT, { key: "Enter", label: "Select Mode" }];

export function AgentExecutionScreen(): ReactElement {
  const { columns, rows } = useTerminalDimensions();
  const { tokens } = useTheme();
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

  const { isListActive, isButtonActive, zone, enterButtons } = useSettingsZone({
    buttonCount: 2,
    disabled: isSaving,
    disabledButtons: canSave ? undefined : [1],
  });

  usePageFooter(
    getSettingsFooter({
      zone,
      listShortcuts: LIST_SHORTCUTS,
      buttonActionLabel: isButtonActive(0) ? "Cancel" : "Save",
      buttonActionDisabled: isButtonActive(1) && !canSave,
    }),
  );

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

  const queryGuardPanels = useQueryGuardPanels("Loading agent execution settings...");
  const guard = guardQueryState(settingsQuery, queryGuardPanels);

  if (guard) return guard;

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 60)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={rows <= 24 ? 0 : 1}>
              <SectionHeader>Agent Execution Mode</SectionHeader>
              <Text dimColor>Choose whether analysis agents run in sequence or in parallel.</Text>
              <RadioGroup
                value={effectiveMode}
                onChange={handleModeChange}
                isActive={isListActive}
                disabled={isSaving}
                wrap={false}
                onNavigationBoundaryReached={(direction) => {
                  if (direction === 1) enterButtons();
                }}
              >
                {AGENT_EXECUTION_OPTIONS.map((option) => (
                  <RadioGroup.Item
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    description={rows <= 24 ? undefined : option.description}
                  />
                ))}
              </RadioGroup>
              {error ? <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text> : null}
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
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
