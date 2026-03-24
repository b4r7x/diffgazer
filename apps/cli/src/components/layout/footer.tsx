import { Box, Text } from "ink";
import type { Shortcut } from "../../types/components.js";
import { useTheme } from "../../theme/theme-context.js";

export interface FooterProps {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}

function ShortcutItem({ shortcut, tokens }: { shortcut: Shortcut; tokens: { accent: string; muted: string } }) {
  return (
    <Box>
      <Text color={tokens.accent} bold>[{shortcut.key}]</Text>
      <Text color={tokens.muted}> {shortcut.label}</Text>
    </Box>
  );
}

export function Footer({ shortcuts, rightShortcuts }: FooterProps) {
  const { tokens } = useTheme();

  return (
    <Box flexDirection="column" width="100%">
      <Text color={tokens.border}>{"─".repeat(80)}</Text>
      <Box flexDirection="row" justifyContent="space-between">
        <Box gap={2}>
          {shortcuts.map((s, i) => (
            <ShortcutItem key={`${s.key}-${i}`} shortcut={s} tokens={tokens} />
          ))}
        </Box>
        {rightShortcuts && rightShortcuts.length > 0 ? (
          <Box gap={2}>
            <Text color={tokens.border}>│</Text>
            {rightShortcuts.map((s, i) => (
              <ShortcutItem key={`r-${s.key}-${i}`} shortcut={s} tokens={tokens} />
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
