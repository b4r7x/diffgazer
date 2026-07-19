import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions";
import { terminalCellWidth } from "../../lib/terminal-width";
import { useTheme } from "../../theme/provider";

export interface FooterProps {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}

interface RowProps {
  shortcuts: Shortcut[];
  tokens: { accent: string; muted: string; fg: string };
  width: number;
}

const SHORTCUT_SEPARATOR = "  •  ";

function shortcutWidth(shortcut: Shortcut): number {
  return terminalCellWidth(`[${shortcut.key}] ${shortcut.label}`);
}

function rowWidth(shortcuts: Shortcut[]): number {
  return shortcuts.reduce(
    (width, shortcut, index) =>
      width + shortcutWidth(shortcut) + (index === 0 ? 0 : terminalCellWidth(SHORTCUT_SEPARATOR)),
    0,
  );
}

function fitShortcuts(shortcuts: Shortcut[], width: number): Shortcut[] {
  const active = shortcuts.filter((shortcut) => !shortcut.disabled);
  const visible: Shortcut[] = [];

  for (const shortcut of active) {
    const candidateWidth = rowWidth([...visible, shortcut]);
    if (candidateWidth > width && visible.length > 0) break;
    visible.push(shortcut);
    if (candidateWidth >= width) break;
  }

  return visible;
}

function ShortcutRow({ shortcuts, tokens, width }: RowProps) {
  const active = fitShortcuts(shortcuts, width);
  return (
    <Box width={width} height={1} overflow="hidden">
      <Text wrap="truncate-end">
        {active.map((shortcut, index) => (
          <Text key={`${shortcut.key}-${shortcut.label}`}>
            {index > 0 ? <Text color={tokens.muted}>{SHORTCUT_SEPARATOR}</Text> : null}
            <Text color={tokens.accent} bold>{`[${shortcut.key}]`}</Text>
            <Text color={tokens.muted}>{` ${shortcut.label}`}</Text>
          </Text>
        ))}
      </Text>
    </Box>
  );
}

export function Footer({ shortcuts, rightShortcuts }: FooterProps) {
  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();
  const activeRight = (rightShortcuts ?? []).filter((shortcut) => !shortcut.disabled);
  const contentWidth = Math.max(columns - 2, 0);
  const hasRightShortcuts = activeRight.length > 0;
  const rightWidth = hasRightShortcuts ? Math.min(rowWidth(activeRight), contentWidth) : 0;
  const rowGap = hasRightShortcuts && shortcuts.length > 0 ? 2 : 0;
  const leftWidth = Math.max(contentWidth - rightWidth - rowGap, 0);

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      paddingY={0}
      height={1}
      overflow="hidden"
    >
      {leftWidth > 0 ? (
        <ShortcutRow shortcuts={shortcuts} tokens={tokens} width={leftWidth} />
      ) : null}
      {hasRightShortcuts ? (
        <ShortcutRow shortcuts={activeRight} tokens={tokens} width={rightWidth} />
      ) : null}
    </Box>
  );
}
