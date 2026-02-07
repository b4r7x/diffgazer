import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Badge, CheckboxGroup, CheckboxItem, ScrollArea, Tabs, TabsList, TabsTrigger, TabsContent, CardLayout } from "@stargazer/ui";
import { useKey, useNavigation, useTabNavigation } from "@stargazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useSettings } from "@/hooks/use-settings";
import { SETTINGS_SHORTCUTS } from "@/config/navigation";
import { api } from "@/lib/api";
import { useContextManagement } from "../../hooks/use-context-management";
import { AGENT_METADATA, LENS_TO_AGENT } from "@stargazer/schemas/events";
import type { LensId } from "@stargazer/schemas/review";

const LENS_OPTIONS = (Object.entries(LENS_TO_AGENT) as Array<[LensId, keyof typeof AGENT_METADATA]>)
  .map(([lensId, agentId]) => {
    const meta = AGENT_METADATA[agentId];
    return {
      id: lensId,
      label: meta.name,
      badgeLabel: meta.badgeLabel,
      badgeVariant: meta.badgeVariant,
      description: meta.description,
    };
  });

export function SettingsAnalysisPage() {
  const navigate = useNavigate();
  const { settings, isLoading } = useSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { contextStatus, contextGeneratedAt, isRefreshing, error, setError, handleRefreshContext } = useContextManagement();

  const tabsListRef = useRef<HTMLDivElement>(null);
  const checkboxRef = useRef<HTMLDivElement>(null);
  const [checkboxFocused, setCheckboxFocused] = useState<string | null>(null);

  const effectiveLenses = selectedLenses ?? (settings?.defaultLenses?.length ? settings.defaultLenses : LENS_OPTIONS.map(l => l.id));

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });
  useKey("Escape", () => navigate({ to: "/settings" }));

  const hasLensSelection = effectiveLenses.length > 0;

  const isDirty = (() => {
    if (!settings || selectedLenses === null) return false;
    const currentLenses = settings.defaultLenses ?? [];
    return (
      currentLenses.length !== selectedLenses.length ||
      currentLenses.some((lens) => !selectedLenses.includes(lens))
    );
  })();

  const toggleLens = (value: string) => {
    const lensId = value as LensId;
    const newLenses = effectiveLenses.includes(lensId)
      ? effectiveLenses.filter((l) => l !== lensId)
      : [...effectiveLenses, lensId];
    setSelectedLenses(newLenses);
  };

  const { onKeyDown: tabsKeyDown } = useTabNavigation({
    containerRef: tabsListRef,
  });

  const { onKeyDown: checkboxKeyDown, focusedValue: checkboxFocusedValue } = useNavigation({
    mode: "local",
    containerRef: checkboxRef,
    role: "checkbox",
    value: checkboxFocused,
    onValueChange: setCheckboxFocused,
    onSelect: toggleLens,
    onEnter: toggleLens,
  });

  const handleSave = async () => {
    if (!hasLensSelection) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.saveSettings({ defaultLenses: effectiveLenses });
      navigate({ to: "/settings" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      setIsSaving(false);
    }
  };

  return (
    <CardLayout
      title="Analysis Settings"
      subtitle="Choose which agents run during reviews."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/settings" })}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={isSaving || !isDirty || !hasLensSelection}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <p className="text-tui-muted">Loading settings...</p>
      ) : (
        <div ref={tabsListRef}>
        <Tabs defaultValue="agents" className="space-y-4">
          <TabsList className="border-b border-tui-border pb-2" onKeyDown={tabsKeyDown}>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="mt-0">
            <ScrollArea className="max-h-[360px] pr-2">
              <div className="space-y-3">
                <div className="text-xs text-tui-muted uppercase tracking-wider font-bold">
                  Active Agents
                </div>
                <CheckboxGroup
                  ref={checkboxRef}
                  value={effectiveLenses}
                  onValueChange={setSelectedLenses}
                  onKeyDown={checkboxKeyDown}
                  focusedValue={checkboxFocusedValue}
                  variant="bullet"
                >
                  {LENS_OPTIONS.map((lens) => (
                    <CheckboxItem
                      key={lens.id}
                      value={lens.id}
                      label={(
                        <span className="flex items-center gap-2">
                          <Badge variant={lens.badgeVariant ?? "info"} size="sm">{lens.badgeLabel}</Badge>
                          <span>{lens.label}</span>
                        </span>
                      )}
                      description={lens.description}
                    />
                  ))}
                </CheckboxGroup>
                {!hasLensSelection && (
                  <p className="text-tui-red text-xs">Select at least one agent.</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="context" className="mt-0">
            <ScrollArea className="max-h-[360px] pr-2">
              <div className="space-y-4">
                <div className="text-xs text-tui-muted uppercase tracking-wider font-bold">
                  Project Context
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleRefreshContext}
                    disabled={isRefreshing}
                  >
                    {isRefreshing
                      ? "Working..."
                      : contextStatus === "ready"
                        ? "Regenerate context"
                        : "Generate context"}
                  </Button>
                  {contextStatus === "ready" && contextGeneratedAt && (
                    <span className="text-xs text-tui-muted">
                      Last generated: {new Date(contextGeneratedAt).toLocaleString()}
                    </span>
                  )}
                  {contextStatus === "missing" && (
                    <span className="text-xs text-tui-muted">
                      Not generated yet.
                    </span>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {error && <p className="text-tui-red text-sm">{error}</p>}
        </Tabs>
        </div>
      )}
    </CardLayout>
  );
}
