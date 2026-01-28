import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";
import { useKeyboardMode } from "../../hooks/use-keyboard-mode.js";
import type { ControlsMode } from "@repo/schemas/settings";
import type { Shortcut, ModeShortcuts } from "@repo/schemas/ui";

export type { Shortcut, ModeShortcuts };

interface FooterBarProps {
  shortcuts?: Shortcut[];
  modeShortcuts?: ModeShortcuts;
  separator?: string;
}

export function FooterBar({
  shortcuts,
  modeShortcuts,
  separator = "  ",
}: FooterBarProps): ReactElement {
  const { colors } = useTheme();
  const { mode } = useKeyboardMode();

  const activeShortcuts = getActiveShortcuts(shortcuts, modeShortcuts, mode);
  const enabledShortcuts = activeShortcuts.filter((s) => !s.disabled);

  return (
    <Box>
      <Text color={colors.ui.textDim}>
        {enabledShortcuts.map((shortcut, i) => (
          <Text key={shortcut.key}>
            [{shortcut.key}] {shortcut.label}
            {i < enabledShortcuts.length - 1 ? separator : ""}
          </Text>
        ))}
      </Text>
    </Box>
  );
}

function getActiveShortcuts(
  shortcuts: Shortcut[] | undefined,
  modeShortcuts: ModeShortcuts | undefined,
  mode: ControlsMode
): Shortcut[] {
  if (modeShortcuts) {
    return mode === "keys" ? modeShortcuts.keys : modeShortcuts.menu;
  }
  return shortcuts ?? [];
}

interface FooterBarWithDividerProps {
  shortcuts: Shortcut[];
  width?: number;
}

export function FooterBarWithDivider({
  shortcuts,
  width = 60,
}: FooterBarWithDividerProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.ui.textDim}>{"\u2500".repeat(width)}</Text>
      <FooterBar shortcuts={shortcuts} />
    </Box>
  );
}
