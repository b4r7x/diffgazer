import { useSettings } from "@diffgazer/core/api/hooks";
import { deriveSaveState } from "@diffgazer/core/forms";
import {
  AGENT_EXECUTION_OPTIONS,
  type AgentExecution,
  isAgentExecution,
} from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { toVerticalBoundaryDirection, useKey, useScope } from "@diffgazer/keys";
import { Callout } from "@diffgazer/ui/components/callout";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useRef, useState } from "react";
import { useSettingsFormActions } from "../../hooks/use-settings-form-actions";
import { SettingsFormPage } from "../form-page";

export function SettingsAgentExecutionPage() {
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useSettings();
  const [modeChoice, setModeChoice] = useState<AgentExecution | null>(null);
  const [focusedMode, setFocusedMode] = useState<AgentExecution | null>(null);

  const settings = settingsQuery.data;
  const { effective: effectiveMode, canSave: canSaveDerived } = deriveSaveState<AgentExecution>({
    persisted: settings?.agentExecution,
    choice: modeChoice,
    saving: false,
    fallback: "sequential",
  });
  const effectiveFocusedMode = focusedMode ?? effectiveMode;

  useScope("settings-agent-execution");

  // Until settings load there is no persisted value to diff against, so keep the
  // save action disabled (the loading guard returns before render, but the footer
  // hook runs).
  const actions = useSettingsFormActions({
    canSave: settings !== undefined && canSaveDerived,
    getSettingsPayload: () => ({ agentExecution: effectiveMode }),
    contentShortcuts: [NAVIGATE_SHORTCUT, { key: "Enter/Space", label: "Select Mode" }],
    focusFallbackRef,
  });
  const { canSave, error, footer, isSaving, onCancel, onSave } = actions;

  const navigationEnabled = settings !== undefined && !footer.inActions && !isSaving;

  const onExecutionChange = (value: string) => {
    if (!isAgentExecution(value)) return;
    setFocusedMode(value);
    setModeChoice(value);
  };

  useKey(" ", () => onExecutionChange(effectiveFocusedMode), { enabled: navigationEnabled });
  useKey("Enter", () => onExecutionChange(effectiveFocusedMode), { enabled: navigationEnabled });

  return (
    <SettingsFormPage
      title="Agent Execution Mode"
      subtitle="Choose whether analysis agents run in sequence or in parallel."
      query={settingsQuery}
      footer={footer}
      isSaving={isSaving}
      canSave={canSave}
      onCancel={onCancel}
      onSave={onSave}
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-6 focus:outline-none">
        <RadioGroup
          aria-label="Agent execution mode"
          value={effectiveMode}
          onChange={onExecutionChange}
          highlighted={navigationEnabled ? effectiveFocusedMode : null}
          onHighlightChange={(value) => {
            if (isAgentExecution(value)) setFocusedMode(value);
          }}
          keyboardNavigation={navigationEnabled}
          activationMode="manual"
          autoFocus={navigationEnabled}
          wrap={false}
          onNavigationBoundaryReached={(direction, event) => {
            if (
              direction === "next" &&
              toVerticalBoundaryDirection(direction, event.key) === "down"
            ) {
              footer.enterActions();
            }
          }}
          className="space-y-1"
        >
          {AGENT_EXECUTION_OPTIONS.map((option) => (
            <RadioGroupItem
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
            />
          ))}
        </RadioGroup>
        {error && (
          <Callout tone="error" live className="text-sm">
            <Callout.Content>{error}</Callout.Content>
          </Callout>
        )}
      </div>
    </SettingsFormPage>
  );
}
