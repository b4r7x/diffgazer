import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckboxGroup, CheckboxItem } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WizardLayout } from "../wizard-layout";
import { useKey } from "@/hooks/keyboard";
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
  const { settings, isLoading: settingsLoading } = useSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { contextStatus, contextGeneratedAt, isRefreshing, error, setError, handleRefreshContext } = useContextManagement();

  const effectiveLenses = selectedLenses ?? (settings?.defaultLenses?.length ? settings.defaultLenses : LENS_OPTIONS.map(l => l.id));

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });
  useKey("Escape", () => navigate({ to: "/settings" }));

  const isLoading = settingsLoading;

  const hasLensSelection = effectiveLenses.length > 0;

  const isDirty = useMemo(() => {
    if (!settings || selectedLenses === null) return false;
    const currentLenses = settings.defaultLenses ?? [];
    return (
      currentLenses.length !== selectedLenses.length ||
      currentLenses.some((lens) => !selectedLenses.includes(lens))
    );
  }, [settings, selectedLenses]);

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
    <WizardLayout
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
        <p className="text-gray-500">Loading settings...</p>
      ) : (
        <Tabs defaultValue="agents" className="space-y-4">
          <TabsList className="border-b border-tui-border pb-2">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="mt-0">
            <ScrollArea className="max-h-[360px] pr-2">
              <div className="space-y-3">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">
                  Active Agents
                </div>
                <CheckboxGroup
                  value={effectiveLenses}
                  onValueChange={setSelectedLenses}
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
                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">
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
                    <span className="text-xs text-gray-500">
                      Last generated: {new Date(contextGeneratedAt).toLocaleString()}
                    </span>
                  )}
                  {contextStatus === "missing" && (
                    <span className="text-xs text-gray-500">
                      Not generated yet.
                    </span>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {error && <p className="text-tui-red text-sm">{error}</p>}
        </Tabs>
      )}
    </WizardLayout>
  );
}
