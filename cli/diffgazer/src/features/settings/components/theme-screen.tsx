import { guardQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { type Theme, toSelectableTheme } from "@diffgazer/core/schemas/config";
import { BACK_SHORTCUT, NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";
import { useSettingsZone } from "../hooks/use-settings-zone";
import { paletteForTheme, TOKEN_GROUPS } from "../lib/theme-preview";
import { type CliTheme, ThemeSelector } from "./theme-selector";

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

interface SettingsThemeEditorProps {
  savedTheme: CliTheme;
}

function SettingsThemeEditor({ savedTheme }: SettingsThemeEditorProps): ReactElement {
  const { columns } = useTerminalDimensions();
  const { tokens: activeTokens, setTheme: applyTheme } = useTheme();
  const saveSettings = useSaveSettings();
  const { goBack } = useNavigation();

  const [selectedTheme, setSelectedTheme] = useState<CliTheme>(savedTheme);
  const [focusedTheme, setFocusedTheme] = useState<CliTheme>(savedTheme);

  const isSaving = saveSettings.isPending;
  const canSave = selectedTheme !== savedTheme;

  const { isListActive, isButtonActive, zone } = useSettingsZone({
    buttonCount: 2,
    disabled: isSaving,
    disabledButtons: canSave ? undefined : [1],
  });

  const previewTheme = isListActive ? focusedTheme : selectedTheme;
  const previewTokens = paletteForTheme(previewTheme);

  function handleCancel(): void {
    goBack();
  }

  function commitAndExit(next: CliTheme): void {
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
    commitAndExit(selectedTheme);
  }

  // Web's `handleEnterOnList`: Enter in the list zone commits + exits, even when
  // the highlighted option matches saved (web also returns immediately in that case).
  useInput(
    (_input, key) => {
      if (!key.return || !isListActive || isSaving) return;
      const next = focusedTheme;
      if (next === savedTheme) {
        goBack();
        return;
      }
      setSelectedTheme(next);
      commitAndExit(next);
    },
    { isActive: isListActive && !isSaving },
  );

  usePageFooter({
    shortcuts:
      zone === "buttons"
        ? [
            { key: "←/→", label: "Move Action" },
            {
              key: "Enter",
              label: isButtonActive(0) ? "Cancel" : "Save",
              disabled: isButtonActive(1) && !canSave,
            },
            { key: "Tab", label: "Switch Zone" },
            BACK_SHORTCUT,
          ]
        : [
            NAVIGATE_SHORTCUT,
            { key: "Space", label: "Select Theme" },
            { key: "Enter", label: "Save & Exit" },
            { key: "Tab", label: "Switch Zone" },
            BACK_SHORTCUT,
          ],
  });

  const saveError = saveSettings.error?.message ?? null;
  const isWide = columns >= 90;

  return (
    <Box flexGrow={1} justifyContent="center">
      <Box flexDirection={isWide ? "row" : "column"} gap={1} width={Math.min(columns, 120)}>
        <Box flexDirection="column" width={isWide ? "40%" : "100%"}>
          <Panel>
            <Panel.Content>
              <Box flexDirection="column" gap={1}>
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
                />
                <Text color={activeTokens.info}>
                  Focus previews themes live. Space selects, Enter saves & exits.
                </Text>
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
                {saveError && <Text color="red">{saveError}</Text>}
              </Box>
            </Panel.Content>
          </Panel>
        </Box>
        <Box flexDirection="column" width={isWide ? "60%" : "100%"}>
          <Panel>
            <Panel.Content>
              <Box flexDirection="column" gap={1}>
                <SectionHeader>Live Preview</SectionHeader>
                <PaletteSwatchGrid tokens={previewTokens} />
              </Box>
            </Panel.Content>
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}

export function ThemeScreen(): ReactElement {
  useBackHandler();

  const settingsQuery = useSettings();

  const guard = guardQueryState(settingsQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Spinner label="Loading theme settings..." />
        </Panel.Content>
      </Panel>
    ),
    error: (err) => (
      <Panel>
        <Panel.Content>
          <Text color="red">Error: {err.message}</Text>
        </Panel.Content>
      </Panel>
    ),
  });
  if (guard) return guard;

  const savedTheme: Theme = settingsQuery.data?.theme ?? "auto";
  const initialTheme: CliTheme = toSelectableTheme(savedTheme);

  return <SettingsThemeEditor key={initialTheme} savedTheme={initialTheme} />;
}
