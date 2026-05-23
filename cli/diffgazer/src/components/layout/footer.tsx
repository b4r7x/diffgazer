import { Box, Text } from "ink";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { useTheme } from "../../theme/theme-context.js";

export interface FooterProps {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}

interface RowProps {
  shortcuts: Shortcut[];
  tokens: { accent: string; muted: string; fg: string };
}

function ShortcutRow({ shortcuts, tokens }: RowProps) {
  const active = shortcuts.filter((shortcut) => !shortcut.disabled);
  return (
    <Box flexDirection="row">
      {active.map((shortcut, index) => (
        <Box key={`${shortcut.key}-${shortcut.label}`} flexDirection="row">
          <Text color={tokens.accent} bold>{`[${shortcut.key}]`}</Text>
          <Text color={tokens.muted}>{` ${shortcut.label}`}</Text>
          {index < active.length - 1 ? (
            <Text color={tokens.muted}>{"  •  "}</Text>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

export function Footer({ shortcuts, rightShortcuts }: FooterProps) {
  const { tokens } = useTheme();

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      paddingY={0}
    >
      <ShortcutRow shortcuts={shortcuts} tokens={tokens} />
      {rightShortcuts && rightShortcuts.length > 0 ? (
        <ShortcutRow shortcuts={rightShortcuts} tokens={tokens} />
      ) : null}
    </Box>
  );
}
