import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import {
  EFFECTIVE_CALL_TOKEN_CAP,
  parseEffectiveCallTokenCap,
  SETTINGS_SCREEN_COPY,
  type SettingsConfig,
} from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import {
  deriveLensSelectionState,
  SELECTABLE_LENS_IDS,
  type SelectableLensId,
} from "@diffgazer/core/schemas/review";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { AnalysisSelector } from "../../../components/shared/analysis-selector";
import { Input } from "../../../components/ui/input";
import { useNavigation } from "../../../hooks/use-navigation";
import { selectionHue } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";
import { SettingsFormScreen } from "./form-screen";

const LENS_SHORTCUTS: Shortcut[] = [NAVIGATE_SHORTCUT, { key: "Space", label: "Toggle Lens" }];
const CAP_SHORTCUTS: Shortcut[] = [NAVIGATE_SHORTCUT, { key: "0-9", label: "Edit Cap" }];

const TOKEN_CAP_LABEL = "Per-call token cap";
const TOKEN_CAP_DESCRIPTION = "Prompt tokens per model call; larger diffs run in batches under it.";
const TOKEN_CAP_ERROR = `Enter a whole number between ${EFFECTIVE_CALL_TOKEN_CAP.min} and ${EFFECTIVE_CALL_TOKEN_CAP.max}.`;

interface TokenCapFieldProps {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  isActive: boolean;
  disabled: boolean;
  compact: boolean;
  onUpBoundary: () => void;
  onDownBoundary: () => void;
}

function TokenCapField({
  value,
  onChange,
  invalid,
  isActive,
  disabled,
  compact,
  onUpBoundary,
  onDownBoundary,
}: TokenCapFieldProps): ReactElement {
  const { tokens } = useTheme();

  useInput(
    (_input, key) => {
      if (key.upArrow) onUpBoundary();
      else if (key.downArrow || key.return) onDownBoundary();
    },
    { isActive: isActive && !disabled },
  );

  return (
    <Box flexDirection="column">
      <Text color={isActive ? selectionHue(tokens) : tokens.fg} bold={isActive}>
        {TOKEN_CAP_LABEL}
      </Text>
      {compact ? null : <Text color={tokens.muted}>{TOKEN_CAP_DESCRIPTION}</Text>}
      <Input value={value} onChange={onChange} size="sm" isActive={isActive} disabled={disabled} />
      {invalid ? <Text color={tokens.error}>{TOKEN_CAP_ERROR}</Text> : null}
    </Box>
  );
}

export function AnalysisScreen(): ReactElement {
  const { tokens } = useTheme();
  const { goBack } = useNavigation();
  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const [selectedLenses, setSelectedLenses] = useState<SelectableLensId[] | null>(null);
  const [capText, setCapText] = useState<string | null>(null);
  const [focus, setFocus] = useState<"lenses" | "cap">("lenses");
  const [error, setError] = useState<string | null>(null);

  const isSaving = saveSettings.isPending;
  const fallbackLenses = [...SELECTABLE_LENS_IDS];
  const {
    effective: effectiveLenses,
    isDirty: lensesDirty,
    hasSelection: hasLensSelection,
  } = deriveLensSelectionState(
    settingsQuery.data?.defaultLenses ?? [],
    selectedLenses,
    fallbackLenses,
  );

  const savedCap = settingsQuery.data?.effectiveCallTokenCap;
  const parsedCap = capText === null ? null : parseEffectiveCallTokenCap(capText);
  const capInvalid = capText !== null && parsedCap === null;
  const capDirty = parsedCap !== null && parsedCap !== savedCap;
  const canSave = !isSaving && (lensesDirty || capDirty) && hasLensSelection && !capInvalid;

  function handleSave() {
    if (!canSave) return;
    setError(null);
    const payload: Partial<SettingsConfig> = { defaultLenses: effectiveLenses };
    if (capDirty) payload.effectiveCallTokenCap = parsedCap;
    saveSettings.mutate(payload, {
      onSuccess: () => {
        setSelectedLenses(null);
        setCapText(null);
        goBack();
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  }

  return (
    <SettingsFormScreen
      title={SETTINGS_SCREEN_COPY.analysis.title}
      subtitle={SETTINGS_SCREEN_COPY.analysis.subtitle}
      loadingLabel="Loading analysis settings..."
      listShortcuts={focus === "cap" ? CAP_SHORTCUTS : LENS_SHORTCUTS}
      saving={isSaving}
      canSave={canSave}
      error={error}
      onSave={handleSave}
    >
      {({ isListActive, enterButtons, isCompact }) => (
        <>
          <AnalysisSelector
            selectedLenses={effectiveLenses}
            onChange={setSelectedLenses}
            isActive={isListActive && focus === "lenses"}
            disabled={isSaving}
            compact={isCompact}
            onDownBoundary={() => setFocus("cap")}
          />
          {!hasLensSelection ? <Text color={tokens.error}>Select at least one lens.</Text> : null}
          <TokenCapField
            value={capText ?? (savedCap === undefined ? "" : String(savedCap))}
            onChange={setCapText}
            invalid={capInvalid}
            isActive={isListActive && focus === "cap"}
            disabled={isSaving}
            compact={isCompact}
            onUpBoundary={() => setFocus("lenses")}
            onDownBoundary={enterButtons}
          />
        </>
      )}
    </SettingsFormScreen>
  );
}
