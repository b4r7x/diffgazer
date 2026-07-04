import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { buildLensOptions } from "@diffgazer/core/schemas/events";
import { BACK_SHORTCUT, NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import {
  ANALYSIS_SETTINGS_SUBTITLE,
  isLensId,
  isLensSelectionDirty,
  type LensId,
  resolveEffectiveLenses,
} from "@diffgazer/core/schemas/review";
import { useKey, useScope } from "@diffgazer/keys";
import { Callout } from "@diffgazer/ui/components/callout";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useSettingsFormFooter } from "../../hooks/use-settings-form-footer";
import { SettingsFormPage } from "../form-page";
import { AnalysisSelectorContent } from "./selector-content";

const lensOptions = buildLensOptions();

export function SettingsAnalysisPage() {
  const navigate = useNavigate();
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useSettings();
  const settings = settingsQuery.data;
  const saveSettings = useSaveSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSaving = saveSettings.isPending;

  const defaultLenses = settings?.defaultLenses ?? [];
  const persistedLenses = defaultLenses.filter((lens): lens is LensId => isLensId(lens));
  const fallbackLenses = lensOptions.map((lens) => lens.id);
  const currentLenses = persistedLenses.length > 0 ? persistedLenses : fallbackLenses;
  const effectiveLenses = resolveEffectiveLenses(persistedLenses, selectedLenses, fallbackLenses);
  const hasLensSelection = effectiveLenses.length > 0;

  const isDirty = settings ? isLensSelectionDirty(currentLenses, selectedLenses) : false;

  useScope("settings-analysis");
  useKey("Escape", () => navigate({ to: "/settings" }), { enabled: !isSaving });

  const canSave = !isSaving && isDirty && hasLensSelection;

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setError(null);
    try {
      await saveSettings.mutateAsync({ defaultLenses: effectiveLenses });
      navigate({ to: "/settings" });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save settings"));
    }
  };

  const footer = useSettingsFormFooter({
    disabledActions: [isSaving, !canSave],
    canSave,
    onCancel: handleCancel,
    onSave: () => void handleSave(),
    contentShortcuts: [NAVIGATE_SHORTCUT, { key: "Enter/Space", label: "Toggle Lens" }],
    rightShortcuts: [BACK_SHORTCUT],
    focusFallbackRef,
  });

  return (
    <SettingsFormPage
      title="Analysis Settings"
      subtitle={ANALYSIS_SETTINGS_SUBTITLE}
      query={settingsQuery}
      footer={footer}
      isSaving={isSaving}
      canSave={canSave}
      onCancel={handleCancel}
      onSave={() => void handleSave()}
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-3 focus:outline-none">
        <AnalysisSelectorContent
          options={lensOptions}
          value={effectiveLenses}
          onChange={setSelectedLenses}
          enabled={!footer.inActions}
          autoFocusList={!footer.inActions}
          disabled={isSaving}
          onBoundaryReached={(direction) => {
            if (direction === "down") {
              footer.enterActions();
            }
          }}
        />
        {!hasLensSelection && <p className="text-error-text text-xs">Select at least one lens.</p>}
      </div>
      {error && (
        <Callout tone="error" live className="text-sm">
          <Callout.Content>{error}</Callout.Content>
        </Callout>
      )}
    </SettingsFormPage>
  );
}
