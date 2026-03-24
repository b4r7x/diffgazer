import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { LensId } from "@diffgazer/schemas/review";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useSettings } from "../../../hooks/use-settings.js";
import { api } from "../../../lib/api.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { AnalysisSelector, lensOptions } from "../../../features/settings/components/analysis-selector.js";

export function AnalysisScreen(): ReactElement {
  useScope("settings-analysis");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Space", label: "Toggle" }] });
  useBackHandler();

  const { settings, isLoading, error: loadError } = useSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const defaultLenses = settings?.defaultLenses ?? [];
  const fallbackLenses = lensOptions.map((l) => l.id);
  const currentLenses = defaultLenses.length > 0 ? defaultLenses : fallbackLenses;
  const effectiveLenses = selectedLenses ?? currentLenses;

  async function handleSave() {
    if (effectiveLenses.length === 0) return;
    setIsSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await api.saveSettings({ defaultLenses: effectiveLenses });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Panel>
        <Panel.Content>
          <Spinner label="Loading analysis settings..." />
        </Panel.Content>
      </Panel>
    );
  }

  if (loadError) {
    return (
      <Panel>
        <Panel.Content>
          <Text color="red">{loadError}</Text>
        </Panel.Content>
      </Panel>
    );
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Analysis Agents</SectionHeader>
          <Text dimColor>Select which agents run during review:</Text>
          <AnalysisSelector
            selectedLenses={effectiveLenses}
            onChange={setSelectedLenses}
            isActive={!isSaving}
            disabled={isSaving}
          />
          {effectiveLenses.length === 0 && (
            <Text color="yellow">Select at least one agent.</Text>
          )}
          <Box gap={1}>
            <Button
              variant="primary"
              onPress={() => { void handleSave(); }}
              disabled={isSaving || effectiveLenses.length === 0}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </Box>
          {saved && <Text color="green">Analysis settings saved.</Text>}
          {saveError && <Text color="red">{saveError}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
