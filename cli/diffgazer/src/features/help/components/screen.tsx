import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUTS, HELP_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useContentZone } from "../../../components/layout/global";
import { Panel } from "../../../components/ui/panel";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SectionHeader } from "../../../components/ui/section-header";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { terminalCellWidth } from "../../../lib/terminal-width";

const HELP_KEY_WIDTH = Math.max(...HELP_SHORTCUTS.map(({ key }) => terminalCellWidth(key)));
const HELP_CHROME_ROWS = 4;

export function HelpScreen(): ReactElement {
  usePageFooter({ shortcuts: BACK_SHORTCUTS });
  useBackHandler();
  const { columns } = useTerminalDimensions();
  const { contentRows } = useContentZone();

  const scrollHeight = Math.max(contentRows - HELP_CHROME_ROWS, 1);

  return (
    <Box justifyContent="center" height={contentRows} overflow="hidden">
      <Box
        width={Math.min(columns, 80)}
        height={contentRows}
        flexDirection="column"
        overflow="hidden"
      >
        <Panel>
          <Panel.Content>
            <ScrollArea height={scrollHeight} isActive>
              <Box flexDirection="column" gap={1}>
                <SectionHeader>Keyboard Shortcuts</SectionHeader>
                <Box flexDirection="column">
                  {HELP_SHORTCUTS.map((s) => (
                    <Box key={`${s.key}:${s.label}`} gap={1}>
                      <Box width={HELP_KEY_WIDTH}>
                        <Text bold>{s.key}</Text>
                      </Box>
                      <Text>{s.label}</Text>
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
