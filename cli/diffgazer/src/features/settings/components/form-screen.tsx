import { guardQueryState, useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement, ReactNode } from "react";
import { useQueryGuardPanels } from "../../../components/shared/query-guard-panels";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { isCompactHeight } from "../../../lib/breakpoints";
import { useTheme } from "../../../theme/provider";
import { getSettingsFooter, useSettingsZone } from "../hooks/use-settings-zone";

interface SettingsFormBody {
  isListActive: boolean;
  enterButtons: () => void;
  isCompact: boolean;
}

export interface SettingsFormScreenProps {
  title: string;
  subtitle: string;
  loadingLabel: string;
  listShortcuts: Shortcut[];
  saving: boolean;
  canSave: boolean;
  /** Already-formatted save failure; each screen keeps its own error strategy. */
  error: string | null;
  onSave: () => void;
  children: (body: SettingsFormBody) => ReactNode;
}

/**
 * The settings form shell: settings query guard, list/buttons zone, footer, the
 * centred panel frame, and the Cancel/Save row. The screen owns its selector,
 * save-state derivation, mutation, and error wording.
 */
export function SettingsFormScreen({
  title,
  subtitle,
  loadingLabel,
  listShortcuts,
  saving,
  canSave,
  error,
  onSave,
  children,
}: SettingsFormScreenProps): ReactElement {
  const { columns, rows } = useTerminalDimensions();
  const { tokens } = useTheme();
  const { goBack } = useNavigation();
  useBackHandler({ isActive: !saving });

  const settingsQuery = useSettings();
  const { isListActive, isButtonActive, zone, enterButtons } = useSettingsZone({
    buttonCount: 2,
    disabled: saving,
    disabledButtons: canSave ? undefined : [1],
  });

  usePageFooter(
    getSettingsFooter({
      zone,
      listShortcuts,
      buttonActionLabel: isButtonActive(0) ? "Cancel" : "Save",
      buttonActionDisabled: isButtonActive(1) && !canSave,
    }),
  );

  const queryGuardPanels = useQueryGuardPanels(loadingLabel);
  const guard = guardQueryState(settingsQuery, queryGuardPanels);

  if (guard) return guard;

  const isCompact = isCompactHeight(rows);

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 60)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={isCompact ? 0 : 1}>
              <SectionHeader>{title}</SectionHeader>
              <Text color={tokens.muted}>{subtitle}</Text>
              {children({ isListActive, enterButtons, isCompact })}
              {error ? <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text> : null}
              <Box gap={1}>
                <Button
                  variant="ghost"
                  onPress={goBack}
                  disabled={saving}
                  isActive={isButtonActive(0)}
                >
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onPress={onSave}
                  disabled={!canSave}
                  isActive={isButtonActive(1)}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </Box>
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
