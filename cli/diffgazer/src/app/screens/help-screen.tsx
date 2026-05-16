import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "@diffgazer/core/footer";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";
import { Panel } from "../../components/ui/panel.js";
import { SectionHeader } from "../../components/ui/section-header.js";

const SHORTCUTS = [
  { key: "↑/↓", label: "Navigate Menus and Lists" },
  { key: "Enter", label: "Select / Confirm" },
  { key: "Esc", label: "Go Back" },
  { key: "Tab", label: "Switch Pane" },
  { key: "1-4", label: "Switch Tab (in Review)" },
  { key: "j/k", label: "Scroll Content" },
  { key: "r", label: "Review Unstaged Changes" },
  { key: "R", label: "Review Staged Changes" },
  { key: "s", label: "Open Settings" },
  { key: "q", label: "Quit" },
];

export function HelpScreen(): ReactElement {
  useScope("help");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }] });
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
                {SHORTCUTS.map((s) => (
                  <Box key={s.key} gap={1}>
                    <Box width={12}>
                      <Text bold>{s.key}</Text>
                    </Box>
                    <Text>{s.label}</Text>
                  </Box>
                ))}
              </Box>
              <SectionHeader>About</SectionHeader>
              <Text>
                diffgazer — Local-only AI code review for your terminal.
              </Text>
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
