import { useSettings } from "@diffgazer/core/api/hooks";
import { SETTINGS_SCREEN_COPY } from "@diffgazer/core/schemas/config";
import { LENS_OPTIONS } from "@diffgazer/core/schemas/events";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { deriveLensSelectionState, type LensId } from "@diffgazer/core/schemas/review";
import { useScope } from "@diffgazer/keys";
import { Callout } from "@diffgazer/ui/components/callout";
import { useId, useRef, useState } from "react";
import { useSettingsFormActions } from "../../hooks/use-form-actions";
import { SettingsFormPage } from "../form-page";
import { AnalysisSelectorContent } from "./selector-content";

export function SettingsAnalysisPage() {
  const lensSelectionMessageId = useId();
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useSettings();
  const settings = settingsQuery.data;
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);

  const fallbackLenses = LENS_OPTIONS.map((lens) => lens.id);
  const {
    effective: effectiveLenses,
    isDirty,
    hasSelection: hasLensSelection,
  } = deriveLensSelectionState(settings?.defaultLenses ?? [], selectedLenses, fallbackLenses);

  useScope("settings-analysis");

  const actions = useSettingsFormActions({
    saveAvailable: isDirty && hasLensSelection,
    getSettingsPayload: () => ({ defaultLenses: effectiveLenses }),
    contentShortcuts: [NAVIGATE_SHORTCUT, { key: "Enter/Space", label: "Toggle Lens" }],
    focusFallbackRef,
  });
  const { canSave, error, footer, isSaving, onCancel, onSave } = actions;

  return (
    <SettingsFormPage
      title={SETTINGS_SCREEN_COPY.analysis.title}
      subtitle={SETTINGS_SCREEN_COPY.analysis.subtitle}
      query={settingsQuery}
      footer={footer}
      isSaving={isSaving}
      canSave={canSave}
      onCancel={onCancel}
      onSave={onSave}
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-3 focus:outline-none">
        <AnalysisSelectorContent
          options={LENS_OPTIONS}
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
        <Callout tone="error" live>
          <Callout.Content>{error}</Callout.Content>
        </Callout>
      )}
    </SettingsFormPage>
  );
}
