import { guardQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { deriveSaveState } from "@diffgazer/core/forms";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import {
  type SelectableTheme,
  type Theme,
  toSelectableTheme,
} from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { useQueryGuardPanels } from "../../../components/shared/query-guard-panels";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";
import { getSettingsFooter, useSettingsZone } from "../hooks/use-settings-zone";
import { paletteForTheme, TOKEN_GROUPS } from "../lib/theme-preview";
import { ThemeSelector } from "./theme-selector";

interface PaletteSwatchGridProps {
  tokens: CliColorTokens;
}

function PaletteSwatchGrid({ tokens }: PaletteSwatchGridProps): ReactElement {
  return (
    <Box flexDirection="column" gap={1}>
      {TOKEN_GROUPS.map((group) => (
        <Box key={group.title} flexDirection="column">
          <Text color={tokens.muted} bold>
            {group.title}
          </Text>
          <Box flexWrap="wrap" gap={1}>
            {group.keys.map((key) => (
              <Box key={key} gap={1}>
                <Text color={tokens[key]}>■</Text>
                <Text color={tokens.fg}>{key}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function PaletteSwatchStrip({ tokens }: PaletteSwatchGridProps): ReactElement {
  const keys = TOKEN_GROUPS.flatMap((group) => group.keys).slice(0, 5);
  return (
    <Box gap={1} overflow="hidden">
      <Text color={tokens.muted}>Live Preview:</Text>
      {keys.map((key) => (
        <Text key={key} color={tokens[key]}>
          ■ {key}
        </Text>
      ))}
    </Box>
  );
}

interface SettingsThemeEditorProps {
  savedTheme: SelectableTheme;
}

function SettingsThemeEditor({ savedTheme }: SettingsThemeEditorProps): ReactElement {
  const { columns, isWide } = useResponsive();
  const { tokens: activeTokens, setTheme: applyTheme } = useTheme();
  const saveSettings = useSaveSettings();
  const { goBack } = useNavigation();

  const [selectedTheme, setSelectedTheme] = useState<SelectableTheme>(savedTheme);
  const [focusedTheme, setFocusedTheme] = useState<SelectableTheme>(savedTheme);

  const isSaving = saveSettings.isPending;
  const { effective: effectiveTheme, canSave } = deriveSaveState<SelectableTheme>({
    persisted: savedTheme,
    choice: selectedTheme,
    saving: isSaving,
    fallback: savedTheme,
  });

  const { isListActive, isButtonActive, zone, enterButtons } = useSettingsZone({
    buttonCount: 2,
    disabled: isSaving,
    disabledButtons: canSave ? undefined : [1],
  });

  const previewTheme = isListActive ? focusedTheme : selectedTheme;
  const previewTokens = paletteForTheme(previewTheme);

  function handleCancel(): void {
    goBack();
  }

  function commitAndExit(next: SelectableTheme): void {
    saveSettings.mutate(
      { theme: next },
      {
        onSuccess: () => {
          applyTheme(next);
          goBack();
        },
      },
    );
  }

  function handleSave(): void {
    if (!canSave || isSaving) return;
    commitAndExit(effectiveTheme);
  }

  useInput(
    (_input, key) => {
      if (!key.return || !isListActive || isSaving) return;
      const next = focusedTheme;
      setSelectedTheme(next);
      commitAndExit(next);
    },
    { isActive: isListActive && !isSaving },
  );

  usePageFooter(
    getSettingsFooter({
      zone,
      listShortcuts: [
        NAVIGATE_SHORTCUT,
        { key: "Space", label: "Select Theme" },
        { key: "Enter", label: "Save & Exit" },
      ],
      buttonActionLabel: isButtonActive(0) ? "Cancel" : "Save",
      buttonActionDisabled: isButtonActive(1) && !canSave,
    }),
  );

  const saveError = saveSettings.error?.message ?? null;
  return (
    <Box flexGrow={1} justifyContent="center">
      <Box flexDirection={isWide ? "row" : "column"} gap={1} width={Math.min(columns, 120)}>
        <Box flexDirection="column" width={isWide ? "40%" : "100%"}>
          <Panel>
            <Panel.Content>
              <Box flexDirection="column" gap={isWide ? 1 : 0}>
                <SectionHeader>Theme Settings</SectionHeader>
                <Text color={activeTokens.muted}>Select Interface Theme:</Text>
                <ThemeSelector
                  value={selectedTheme}
                  onChange={(value) => {
                    setSelectedTheme(value);
                    setFocusedTheme(value);
                  }}
                  onHighlightChange={setFocusedTheme}
                  isActive={isListActive}
                  onDownBoundary={enterButtons}
                />
                <Text color={activeTokens.info}>
                  Focus previews themes live. Space selects, Enter saves & exits.
                </Text>
                {!isWide ? <PaletteSwatchStrip tokens={previewTokens} /> : null}
                {saveError ? (
                  <Text color={activeTokens.error}>{sanitizeTerminalText(saveError)}</Text>
                ) : null}
                <Box gap={2}>
                  <Button variant="ghost" onPress={handleCancel} isActive={isButtonActive(0)}>
                    Cancel
                  </Button>
                  <Button
                    variant="success"
                    onPress={handleSave}
                    disabled={!canSave || isSaving}
                    loading={isSaving}
                    isActive={isButtonActive(1) && canSave}
                  >
                    Save
                  </Button>
                </Box>
              </Box>
            </Panel.Content>
          </Panel>
        </Box>
        {isWide ? (
          <Box flexDirection="column" width="60%">
            <Panel>
              <Panel.Content>
                <Box flexDirection="column" gap={1}>
                  <SectionHeader>Live Preview</SectionHeader>
                  <PaletteSwatchGrid tokens={previewTokens} />
                </Box>
              </Panel.Content>
            </Panel>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

export function ThemeScreen(): ReactElement {
  useBackHandler();

  const settingsQuery = useSettings();
  const queryGuardPanels = useQueryGuardPanels("Loading theme settings...");

  const guard = guardQueryState(settingsQuery, queryGuardPanels);
  if (guard) return guard;

  const savedTheme: Theme = settingsQuery.data?.theme ?? "auto";
  const initialTheme: SelectableTheme = toSelectableTheme(savedTheme);

  return <SettingsThemeEditor key={initialTheme} savedTheme={initialTheme} />;
}
