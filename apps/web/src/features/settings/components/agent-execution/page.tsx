import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { AgentExecution } from "@diffgazer/schemas/config";
import type { Shortcut } from "@diffgazer/schemas/ui";
import { Button } from "diffui/components/button";
import { RadioGroup, RadioGroupItem } from "diffui/components/radio";
import { CardLayout } from "@/components/ui/card-layout";
import { useKey, useScope } from "keyscope";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useFooterNavigation } from "@/hooks/use-footer-navigation.js";
import { useSettings, useSaveSettings, matchQueryState } from "@diffgazer/api/hooks";
import { cn } from "@/utils/cn";

export function SettingsAgentExecutionPage() {
  const navigate = useNavigate();
  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const [modeChoice, setModeChoice] = useState<AgentExecution | null>(null);
  const [focusedMode, setFocusedMode] = useState<AgentExecution>("sequential");
  const [error, setError] = useState<string | null>(null);
  const isSaving = saveSettings.isPending;

  const settings = settingsQuery.data;
  const effectiveMode = modeChoice ?? settings?.agentExecution ?? "sequential";

  useEffect(() => {
    setFocusedMode(effectiveMode);
  }, [effectiveMode]);

  useScope("settings-agent-execution");
  useKey("Escape", () => navigate({ to: "/settings" }));

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
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  };

  const footer = useFooterNavigation({
    enabled: true,
    buttonCount: 2,
    onAction: (index) => {
      if (index === 0) handleCancel();
      else if (index === 1 && canSave) void handleSave();
    },
  });

  const footerShortcuts: Shortcut[] = footer.inFooter
    ? [
        { key: "←/→", label: "Move Action" },
        {
          key: "Enter/Space",
          label: footer.focusedIndex === 0 ? "Cancel" : "Save",
          disabled: footer.focusedIndex === 1 && !canSave,
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

  const navigationEnabled = !footer.inFooter && !isSaving;

  const onExecutionChange = (value: string) => {
    const mode = value as AgentExecution;
    setFocusedMode(mode);
    setModeChoice(mode);
  };

  const executionOptions: AgentExecution[] = ["sequential", "parallel"];

  const moveFocus = (direction: 1 | -1) => {
    const idx = executionOptions.indexOf(focusedMode);
    const next = idx + direction;
    if (next < 0) return;
    if (next >= executionOptions.length) {
      footer.enterFooter();
      return;
    }
    setFocusedMode(executionOptions[next]!);
  };

  useKey("ArrowDown", () => moveFocus(1), { enabled: navigationEnabled });
  useKey("ArrowUp", () => moveFocus(-1), { enabled: navigationEnabled });

  useKey(" ", () => onExecutionChange(focusedMode), { enabled: navigationEnabled });
  useKey("Enter", () => onExecutionChange(focusedMode), { enabled: navigationEnabled });

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
      footer={
        <>
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className={cn(footer.inFooter && footer.focusedIndex === 0 && "ring-2 ring-tui-blue")}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(footer.inFooter && footer.focusedIndex === 1 && "ring-2 ring-tui-blue")}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <RadioGroup
          value={effectiveMode}
          onChange={onExecutionChange}
          highlighted={navigationEnabled ? focusedMode : null}
          onHighlightChange={(v) => setFocusedMode(v as AgentExecution)}
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
