import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUTS, HELP_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { terminalCellWidth } from "../../../lib/terminal-width";

const HELP_KEY_WIDTH = Math.max(...HELP_SHORTCUTS.map(({ key }) => terminalCellWidth(key)));

export function HelpScreen(): ReactElement {
  usePageFooter({ shortcuts: BACK_SHORTCUTS });
  useBackHandler();
  const { columns } = useTerminalDimensions();

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 80)} flexDirection="column">
        <Panel>
          <Panel.Content>
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
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
