import { useSettings } from "@diffgazer/core/api/hooks";
import { buildLensOptions } from "@diffgazer/core/schemas/events";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import {
  ANALYSIS_SETTINGS_SUBTITLE,
  isLensId,
  isLensSelectionDirty,
  type LensId,
  resolveEffectiveLenses,
} from "@diffgazer/core/schemas/review";
import { useScope } from "@diffgazer/keys";
import { Callout } from "@diffgazer/ui/components/callout";
import { useId, useRef, useState } from "react";
import { useSettingsFormActions } from "../../hooks/use-settings-form-actions";
import { SettingsFormPage } from "../form-page";
import { AnalysisSelectorContent } from "./selector-content";

const lensOptions = buildLensOptions();

export function SettingsAnalysisPage() {
  const lensSelectionMessageId = useId();
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useSettings();
  const settings = settingsQuery.data;
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);

  const defaultLenses = settings?.defaultLenses ?? [];
  const persistedLenses = defaultLenses.filter((lens): lens is LensId => isLensId(lens));
  const fallbackLenses = lensOptions.map((lens) => lens.id);
  const currentLenses = persistedLenses.length > 0 ? persistedLenses : fallbackLenses;
  const effectiveLenses = resolveEffectiveLenses(persistedLenses, selectedLenses, fallbackLenses);
  const hasLensSelection = effectiveLenses.length > 0;

  const isDirty = settings ? isLensSelectionDirty(currentLenses, selectedLenses) : false;

  useScope("settings-analysis");

  const actions = useSettingsFormActions({
    canSave: isDirty && hasLensSelection,
    getSettingsPayload: () => ({ defaultLenses: effectiveLenses }),
    contentShortcuts: [NAVIGATE_SHORTCUT, { key: "Enter/Space", label: "Toggle Lens" }],
    focusFallbackRef,
  });
  const { canSave, error, footer, isSaving, onCancel, onSave } = actions;

  return (
    <SettingsFormPage
      title="Analysis Settings"
      subtitle={ANALYSIS_SETTINGS_SUBTITLE}
      query={settingsQuery}
      footer={footer}
      isSaving={isSaving}
      canSave={canSave}
      onCancel={onCancel}
      onSave={onSave}
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-3 focus:outline-none">
        <AnalysisSelectorContent
          options={lensOptions}
          value={effectiveLenses}
          onChange={setSelectedLenses}
          enabled={!footer.inActions}
          autoFocusList={!footer.inActions}
          disabled={isSaving}
          required
          invalid={!hasLensSelection}
          descriptionId={lensSelectionMessageId}
          onBoundaryReached={(direction) => {
            if (direction === "down") {
              footer.enterActions();
            }
          }}
        />
        <output
          id={lensSelectionMessageId}
          aria-live="polite"
          aria-atomic="true"
          className={hasLensSelection ? "sr-only" : "text-error-text text-xs"}
        >
          {hasLensSelection ? null : "Select at least one lens."}
        </output>
      </div>
      {error && (
        <Callout tone="error" live className="text-sm">
          <Callout.Content>{error}</Callout.Content>
        </Callout>
      )}
    </SettingsFormPage>
  );
}
