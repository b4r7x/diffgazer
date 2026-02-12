import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { AgentExecution } from "@diffgazer/schemas/config";
import type { Shortcut } from "@diffgazer/schemas/ui";
import { Button, CardLayout, RadioGroup, RadioGroupItem } from "@diffgazer/ui";
import { useNavigation, useKey, useScope } from "keyscope";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useSettings } from "@/hooks/use-settings";
import { api } from "@/lib/api";
import { cn } from "@/utils/cn";

type FocusZone = "list" | "buttons";
const BUTTONS_COUNT = 2;

export function SettingsAgentExecutionPage() {
  const navigate = useNavigate();
  const { settings, isLoading, error: settingsError, refresh } = useSettings();
  const [modeChoice, setModeChoice] = useState<AgentExecution | null>(null);
  const [focusedMode, setFocusedMode] = useState<AgentExecution>("sequential");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [buttonIndex, setButtonIndex] = useState(0);
  const radioRef = useRef<HTMLDivElement>(null);

  const effectiveMode = modeChoice ?? settings?.agentExecution ?? "sequential";

  useEffect(() => {
    setFocusedMode(effectiveMode);
  }, [effectiveMode]);

  useEffect(() => {
    if (!isLoading && !settingsError) {
      setFocusZone("list");
      setButtonIndex(0);
    }
  }, [isLoading, settingsError]);

  useScope("settings-agent-execution");
  useKey("Escape", () => navigate({ to: "/settings" }));

  const isDirty = settings ? settings.agentExecution !== effectiveMode : false;
  const isButtonsZone = focusZone === "buttons";
  const canSave = !isSaving && isDirty;

  const footerShortcuts: Shortcut[] = isButtonsZone
    ? [
        { key: "←/→", label: "Move Action" },
        {
          key: "Enter/Space",
          label: buttonIndex === 0 ? "Cancel" : "Save",
          disabled: buttonIndex === 1 && !canSave,
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

  const navigationEnabled = !isButtonsZone && !isLoading && !settingsError && !isSaving;

  const onExecutionChange = (value: string) => {
    const mode = value as AgentExecution;
    setFocusedMode(mode);
    setModeChoice(mode);
  };

  const { focusedValue } = useNavigation({
    containerRef: radioRef,
    role: "radio",
    value: focusedMode,
    onValueChange: (value) => setFocusedMode(value as AgentExecution),
    onSelect: onExecutionChange,
    onEnter: onExecutionChange,
    wrap: false,
    enabled: navigationEnabled,
    onBoundaryReached: (direction) => {
      if (direction === "down") setFocusZone("buttons");
    },
  });

  useKey("ArrowUp", () => {
    setFocusZone("list");
    setButtonIndex(0);
  }, { enabled: isButtonsZone, preventDefault: true });

  useKey("ArrowDown", () => {}, { enabled: isButtonsZone, preventDefault: true });

  useKey("ArrowLeft", () => setButtonIndex(Math.max(0, buttonIndex - 1)), {
    enabled: isButtonsZone, preventDefault: true,
  });

  useKey("ArrowRight", () => setButtonIndex(Math.min(BUTTONS_COUNT - 1, buttonIndex + 1)), {
    enabled: isButtonsZone, preventDefault: true,
  });

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.saveSettings({ agentExecution: effectiveMode });
      await refresh();
      navigate({ to: "/settings" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      setIsSaving(false);
    }
  };

  const activateButton = () => {
    if (buttonIndex === 0) handleCancel();
    else if (buttonIndex === 1 && canSave) void handleSave();
  };

  useKey("Enter", activateButton, { enabled: isButtonsZone });
  useKey(" ", activateButton, { enabled: isButtonsZone, preventDefault: true });

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
            className={cn(isButtonsZone && buttonIndex === 0 && "ring-2 ring-tui-blue")}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(isButtonsZone && buttonIndex === 1 && "ring-2 ring-tui-blue")}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <p className="text-tui-muted">Loading settings...</p>
      ) : (
        <div className="space-y-6">
          <RadioGroup
            ref={radioRef}
            value={effectiveMode}
            onValueChange={onExecutionChange}
            focusedValue={navigationEnabled ? focusedValue : null}
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
          {(error || settingsError) && <p className="text-tui-red text-sm">{error || settingsError}</p>}
        </div>
      )}
    </CardLayout>
  );
}
