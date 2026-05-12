import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { AgentExecution } from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/ui";
import { getErrorMessage } from "@diffgazer/core/errors";
import { Button } from "@diffgazer/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { CardLayout } from "@/components/ui/card-layout";
import { toVerticalBoundaryDirection, useKey, useScope } from "@diffgazer/keys";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useActionRowNavigation } from "@diffgazer/keys";
import { useSettings, useSaveSettings, matchQueryState } from "@diffgazer/core/api/hooks";

const EXECUTION_MODES: AgentExecution[] = ["sequential", "parallel"];

function isAgentExecution(value: string | null): value is AgentExecution {
  return EXECUTION_MODES.some((mode) => mode === value);
}

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
  const effectiveMode = modeChoice ?? settings?.agentExecution ?? "sequential";
  const effectiveFocusedMode = focusedMode ?? effectiveMode;

  useScope("settings-agent-execution");
  useKey("Escape", () => navigate({ to: "/settings" }));

  const isDirty = settings ? settings.agentExecution !== effectiveMode : false;
  const canSave = !isSaving && isDirty;
  const isSaveDisabled = !canSave;

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
    disabledActions: [isSaving, isSaveDisabled],
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

  const guard = matchQueryState(settingsQuery, {
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

  if (guard) return guard;

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
            if (direction === "next" && toVerticalBoundaryDirection(direction, event.key) === "down") {
              footer.enterActions();
            }
          }}
          className="space-y-1"
        >
          <RadioGroupItem
            value="sequential"
            label="Sequential"
            description="Agents run one after another. Works with all providers and tiers."
          />
          <RadioGroupItem
            value="parallel"
            label="Parallel"
            description="All agents run at once. Faster, but may hit rate limits on free tiers."
          />
        </RadioGroup>
        {error && <p className="text-tui-red text-sm">{error}</p>}
      </div>
    </CardLayout>
  );
}
