import { matchQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import { deriveSaveState } from "@diffgazer/core/forms";
import {
  AGENT_EXECUTION_OPTIONS,
  type AgentExecution,
  isAgentExecution,
} from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import {
  toVerticalBoundaryDirection,
  useActionRowNavigation,
  useKey,
  useScope,
} from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CardLayout } from "@/components/ui/card-layout";

export function SettingsAgentExecutionPage() {
  const navigate = useNavigate();
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const [modeChoice, setModeChoice] = useState<AgentExecution | null>(null);
  const [focusedMode, setFocusedMode] = useState<AgentExecution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSaving = saveSettings.isPending;

  const settings = settingsQuery.data;
  const { effective: effectiveMode } = deriveSaveState<AgentExecution>({
    persisted: settings?.agentExecution,
    choice: modeChoice,
    saving: isSaving,
    fallback: "sequential",
  });
  const effectiveFocusedMode = focusedMode ?? effectiveMode;

  useScope("settings-agent-execution");
  useKey("Escape", () => navigate({ to: "/settings" }), { enabled: !isSaving });

  // Until settings load, treat the page as not dirty so the save action stays
  // disabled (the loading guard returns before render, but the footer hook runs).
  const isDirty = settings ? settings.agentExecution !== effectiveMode : false;
  const canSave = !isSaving && isDirty;

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setError(null);
    try {
      await saveSettings.mutateAsync({ agentExecution: effectiveMode });
      navigate({ to: "/settings" });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save settings"));
    }
  };

  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: 2,
    disabledActions: [isSaving, !canSave],
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: (index) => {
      if (index === 0) handleCancel();
      else if (index === 1 && canSave) void handleSave();
    },
  });

  const footerShortcuts: Shortcut[] = footer.inActions
    ? [
        { key: "←/→", label: "Move Action" },
        {
          key: "Enter/Space",
          label: footer.focusedIndex === 0 ? "Cancel" : "Save",
          disabled: footer.isFocusedActionDisabled,
        },
      ]
    : [
        { key: "↑/↓", label: "Navigate" },
        { key: "Enter/Space", label: "Select Mode" },
      ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  const navigationEnabled = settings !== undefined && !footer.inActions && !isSaving;

  const onExecutionChange = (value: string) => {
    if (!isAgentExecution(value)) return;
    setFocusedMode(value);
    setModeChoice(value);
  };

  useKey(" ", () => onExecutionChange(effectiveFocusedMode), { enabled: navigationEnabled });
  useKey("Enter", () => onExecutionChange(effectiveFocusedMode), { enabled: navigationEnabled });

  const pendingUI = matchQueryState(settingsQuery, {
    loading: () => (
      <CardLayout
        title="Agent Execution Mode"
        subtitle="Choose whether analysis agents run in sequence or in parallel."
      >
        <p className="text-tui-muted">Loading settings...</p>
      </CardLayout>
    ),
    error: (err) => (
      <CardLayout
        title="Agent Execution Mode"
        subtitle="Choose whether analysis agents run in sequence or in parallel."
      >
        <p className="text-tui-red text-sm">{err.message}</p>
      </CardLayout>
    ),
    success: () => null,
  });

  if (pendingUI) return pendingUI;

  return (
    <CardLayout
      title="Agent Execution Mode"
      subtitle="Choose whether analysis agents run in sequence or in parallel."
      contentInactive={footer.inActions}
      footer={
        <>
          <Button
            {...footer.getActionProps(0)}
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            highlighted={footer.inActions && footer.focusedIndex === 0 && !isSaving}
          >
            Cancel
          </Button>
          <Button
            {...footer.getActionProps(1)}
            variant="success"
            onClick={handleSave}
            disabled={!canSave}
            highlighted={footer.inActions && footer.focusedIndex === 1 && canSave}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-6 focus:outline-none">
        <RadioGroup
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
    </CardLayout>
  );
}
