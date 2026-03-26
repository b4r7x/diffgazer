import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "../../hooks/use-page-footer.js";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";
import { Panel } from "../../components/ui/panel.js";
import { SectionHeader } from "../../components/ui/section-header.js";

const SHORTCUTS = [
  { key: "↑/↓", label: "Navigate menus and lists" },
  { key: "Enter", label: "Select / confirm" },
  { key: "Esc", label: "Go back" },
  { key: "Tab", label: "Switch pane" },
  { key: "1-4", label: "Switch tab (in review)" },
  { key: "j/k", label: "Scroll content" },
  { key: "r", label: "Review unstaged changes" },
  { key: "R", label: "Review staged changes" },
  { key: "s", label: "Open settings" },
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
