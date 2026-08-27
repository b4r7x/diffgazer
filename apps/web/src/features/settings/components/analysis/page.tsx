import { useSettings } from "@diffgazer/core/api/hooks";
import {
  DEFAULT_SETTINGS,
  EFFECTIVE_CALL_TOKEN_CAP,
  parseEffectiveCallTokenCap,
  SETTINGS_SCREEN_COPY,
} from "@diffgazer/core/schemas/config";
import { LENS_OPTIONS } from "@diffgazer/core/schemas/events";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { deriveLensSelectionState, type SelectableLensId } from "@diffgazer/core/schemas/review";
import { findNavigationItemByValue, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { Field } from "@diffgazer/ui/components/field";
import { Input } from "@diffgazer/ui/components/input";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { useSettingsFormActions } from "../../hooks/use-form-actions";
import { SettingsFormPage } from "../form-page";
import { AnalysisSelectorContent } from "./selector-content";

const TOKEN_CAP_ERROR = `Enter a whole number between ${EFFECTIVE_CALL_TOKEN_CAP.min.toLocaleString("en-US")} and ${EFFECTIVE_CALL_TOKEN_CAP.max.toLocaleString("en-US")}.`;
const TOKEN_CAP_PLACEHOLDER = `${EFFECTIVE_CALL_TOKEN_CAP.default.toLocaleString("en-US")} (default)`;

type CapZone = "list" | "capInput" | "capReset";

export function SettingsAnalysisPage() {
  const lensSelectionMessageId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const tokenCapInputRef = useRef<HTMLInputElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const settingsQuery = useSettings();
  const settings = settingsQuery.data;
  const [selectedLenses, setSelectedLenses] = useState<SelectableLensId[] | null>(null);
  const [tokenCapDraft, setTokenCapDraft] = useState<string | null>(null);
  const [ownZone, setOwnZone] = useState<CapZone>("list");

  const fallbackLenses = LENS_OPTIONS.map((lens) => lens.id);
  const {
    effective: effectiveLenses,
    isDirty,
    hasSelection: hasLensSelection,
  } = deriveLensSelectionState(settings?.defaultLenses ?? [], selectedLenses, fallbackLenses);

  const persistedTokenCap =
    settings?.effectiveCallTokenCap ?? DEFAULT_SETTINGS.effectiveCallTokenCap;
  const persistedOverrideText =
    persistedTokenCap === EFFECTIVE_CALL_TOKEN_CAP.default ? "" : String(persistedTokenCap);
  const tokenCapText = tokenCapDraft ?? persistedOverrideText;
  const tokenCap =
    tokenCapText.trim() === ""
      ? EFFECTIVE_CALL_TOKEN_CAP.default
      : parseEffectiveCallTokenCap(tokenCapText);
  const isTokenCapDirty = tokenCap !== null && tokenCap !== persistedTokenCap;

  useScope("settings-analysis");

  const actions = useSettingsFormActions({
    saveAvailable: (isDirty || isTokenCapDirty) && hasLensSelection && tokenCap !== null,
    getSettingsPayload: () => ({
      defaultLenses: effectiveLenses,
      ...(tokenCap !== null && { effectiveCallTokenCap: tokenCap }),
    }),
    contentShortcuts: [NAVIGATE_SHORTCUT, { key: "Enter/Space", label: "Toggle Lens" }],
    focusFallbackRef: tokenCapInputRef,
  });
  const { canSave, error, footer, isSaving, onCancel, onSave } = actions;

  const showReset = tokenCapText !== "";
  const safeZone = ownZone === "capReset" && !showReset ? "capInput" : ownZone;
  const focusZone = footer.inActions ? "footer" : safeZone;

  const focusLastLens = () => {
    const lastLensId = LENS_OPTIONS.at(-1)?.id;
    if (lastLensId) {
      findNavigationItemByValue(contentRef.current, {
        type: "checkbox",
        value: lastLensId,
        ownerSelector: null,
      })?.focus();
    }
  };

  // The cap row sits below the lens list, outside the checkbox group's roving
  // focus, so vertical arrows have to be bridged by hand in both directions.
  const handleTokenCapKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      footer.enterActions();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusLastLens();
      return;
    }
    if (event.key === "ArrowRight") {
      const input = event.currentTarget;
      const caretAtEnd =
        input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
      if (showReset && caretAtEnd) {
        event.preventDefault();
        resetButtonRef.current?.focus();
      }
    }
  };

  const handleResetKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      tokenCapInputRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      footer.enterActions();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusLastLens();
    }
  };

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
      <div ref={contentRef} className="space-y-3">
        <AnalysisSelectorContent
          options={LENS_OPTIONS}
          value={effectiveLenses}
          onChange={setSelectedLenses}
          enabled={focusZone === "list"}
          autoFocusList={focusZone === "list"}
          disabled={isSaving}
          onFocus={() => footer.reset()}
          required
          invalid={!hasLensSelection}
          descriptionId={lensSelectionMessageId}
          onBoundaryReached={(direction) => {
            if (direction === "down") {
              tokenCapInputRef.current?.focus();
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
        <div
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOwnZone("list");
          }}
        >
          <Field invalid={tokenCap === null} disabled={isSaving}>
            <Field.Label>Per-call token cap</Field.Label>
            <Field.Description>
              Ceiling on prompt tokens per model call. Diffs that estimate over the cap are reviewed
              in batches under it.
            </Field.Description>
            <div className="flex items-center gap-2">
              <Field.Control>
                <Input
                  ref={tokenCapInputRef}
                  className="flex-1"
                  inputMode="numeric"
                  placeholder={TOKEN_CAP_PLACEHOLDER}
                  value={tokenCapText}
                  onChange={(event) => setTokenCapDraft(event.target.value)}
                  onFocus={() => {
                    footer.reset();
                    setOwnZone("capInput");
                  }}
                  onKeyDown={handleTokenCapKeyDown}
                />
              </Field.Control>
              {showReset && (
                <Button
                  ref={resetButtonRef}
                  type="button"
                  variant="ghost"
                  bracket
                  disabled={isSaving}
                  highlighted={focusZone === "capReset"}
                  onFocus={() => setOwnZone("capReset")}
                  onKeyDown={handleResetKeyDown}
                  onClick={() => {
                    setTokenCapDraft("");
                    tokenCapInputRef.current?.focus();
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
            <Field.Error>{TOKEN_CAP_ERROR}</Field.Error>
          </Field>
        </div>
      </div>
      {error && (
        <Callout tone="error" live>
          <Callout.Content>{error}</Callout.Content>
        </Callout>
      )}
    </SettingsFormPage>
  );
}
