import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUTS, HELP_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";

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
                  <Box key={s.key} gap={1}>
                    <Box width={12}>
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
