import { usePageFooter } from "@diffgazer/core/footer";
import {
  BACK_SHORTCUTS,
  groupShortcutsByContext,
  HELP_SHORTCUTS,
  SHORTCUT_CONTEXT_LABELS,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useContentZone } from "../../../components/layout/global";
import { Panel } from "../../../components/ui/panel";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SectionHeader } from "../../../components/ui/section-header";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { terminalCellWidth } from "../../../lib/terminal-width";

// One key column across every group, so the table stays aligned over a header.
const HELP_KEY_WIDTH = Math.max(...HELP_SHORTCUTS.map(({ key }) => terminalCellWidth(key)));
const HELP_CHROME_ROWS = 5;

const HELP_GROUPS = groupShortcutsByContext(HELP_SHORTCUTS);

// The grouped table, the About header and its line, plus one blank row between
// those three blocks. Group headers separate the groups, so they carry no gap.
const HELP_CONTENT_ROWS =
  HELP_GROUPS.reduce((rows, group) => rows + 1 + group.shortcuts.length, 0) + 2 + 2;

export function HelpScreen(): ReactElement {
  usePageFooter({ shortcuts: BACK_SHORTCUTS });
  useBackHandler();
  const { columns } = useTerminalDimensions();
  const { contentRows } = useContentZone();

  // Claim the zone only up to what the body actually needs, so the panel never
  // reserves blank rows above its own bottom border.
  const scrollHeight = Math.max(Math.min(contentRows - HELP_CHROME_ROWS, HELP_CONTENT_ROWS), 1);

  return (
    <Box justifyContent="center" height={contentRows} overflow="hidden">
      <Box
        width={Math.min(columns, 80)}
        height={contentRows}
        flexDirection="column"
        overflow="hidden"
      >
        <Panel>
          <Panel.Header variant="subtle">HELP</Panel.Header>
          <Panel.Content>
            <ScrollArea height={scrollHeight} isActive>
              <Box flexDirection="column" gap={1}>
                <Box flexDirection="column">
                  {HELP_GROUPS.map((group) => (
                    <Box key={group.context} flexDirection="column">
                      <SectionHeader variant="muted">
                        {SHORTCUT_CONTEXT_LABELS[group.context]}
                      </SectionHeader>
                      {group.shortcuts.map((shortcut) => (
                        <Box key={`${shortcut.key}:${shortcut.label}`} gap={1}>
                          <Box width={HELP_KEY_WIDTH}>
                            <Text bold>{shortcut.key}</Text>
                          </Box>
                          <Text>{shortcut.label}</Text>
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Box>
                <SectionHeader>About</SectionHeader>
                <Text>diffgazer — Local-only AI code review for your terminal.</Text>
              </Box>
            </ScrollArea>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
