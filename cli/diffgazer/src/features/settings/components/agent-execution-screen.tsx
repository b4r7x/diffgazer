import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { deriveSaveState } from "@diffgazer/core/forms";
import {
  AGENT_EXECUTION_OPTIONS,
  type AgentExecution,
  isAgentExecution,
  SETTINGS_SCREEN_COPY,
} from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import type { ReactElement } from "react";
import { useState } from "react";
import { RadioGroup } from "../../../components/ui/radio";
import { useNavigation } from "../../../hooks/use-navigation";
import { SettingsFormScreen } from "./form-screen";

const LIST_SHORTCUTS: Shortcut[] = [NAVIGATE_SHORTCUT, { key: "Enter", label: "Select Mode" }];

export function AgentExecutionScreen(): ReactElement {
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

  return (
    <SettingsFormScreen
      title={SETTINGS_SCREEN_COPY["agent-execution"].title}
      subtitle={SETTINGS_SCREEN_COPY["agent-execution"].subtitle}
      loadingLabel="Loading agent execution settings..."
      listShortcuts={LIST_SHORTCUTS}
      saving={isSaving}
      canSave={canSave}
      error={error}
      onSave={handleSave}
    >
      {({ isListActive, enterButtons, isCompact }) => (
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
              description={isCompact ? undefined : option.description}
            />
          ))}
        </RadioGroup>
      )}
    </SettingsFormScreen>
  );
}
