import type { ReactElement } from "react";
import { useState, useMemo } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import os from "node:os";
import chalk from "chalk";
import { Panel, PanelHeader, PanelContent, PanelDivider } from "../../components/ui/panel.js";
import { useTheme } from "../../hooks/use-theme.js";

interface SettingsDiagnosticsViewProps {
  onBack: () => void;
  isActive?: boolean;
}

type ButtonId = "print" | "export" | "reset";

interface ActionButton {
  id: ButtonId;
  label: string;
  focusColor: string;
}

const ACTION_BUTTONS: ActionButton[] = [
  { id: "print", label: "Print Paths", focusColor: "blue" },
  { id: "export", label: "Export Debug Report", focusColor: "green" },
  { id: "reset", label: "Reset UI Settings", focusColor: "red" },
];

function getColorDepth(): string {
  const level = chalk.level;
  if (level === 0) return "None";
  if (level === 1) return "16";
  if (level === 2) return "256";
  return "24-bit";
}

function getUnicodeSupport(): { supported: boolean; label: string } {
  const lang = process.env.LANG ?? "";
  const lcAll = process.env.LC_ALL ?? "";
  const isUtf = lang.includes("UTF-8") || lcAll.includes("UTF-8") || process.stdout.isTTY === true;
  return {
    supported: isUtf,
    label: isUtf ? "Full Support" : "Limited",
  };
}

function formatBytes(bytes: number): string {
  const mb = Math.round(bytes / 1024 / 1024);
  return `${mb}MB`;
}

export function SettingsDiagnosticsView({
  onBack,
  isActive = true,
}: SettingsDiagnosticsViewProps): ReactElement {
  const { colors } = useTheme();
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const panelWidth = Math.min(72, terminalWidth - 4);

  const [focusedButton, setFocusedButton] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const systemInfo = useMemo(() => {
    const mem = process.memoryUsage();
    const cols = process.stdout.columns ?? 80;
    const rows = process.stdout.rows ?? 24;
    const isTTY = process.stdout.isTTY ?? false;
    const unicode = getUnicodeSupport();
    const homeDir = os.homedir();

    return {
      appVersion: "v1.4.2",
      nodeVersion: process.version,
      terminalSize: `${cols}x${rows}`,
      isTTY,
      colorDepth: getColorDepth(),
      unicode,
      rss: formatBytes(mem.rss),
      heap: formatBytes(mem.heapUsed),
      paths: {
        config: `${homeDir}/.config/stargazer`,
        data: `${homeDir}/.local/share/stargazer/runs`,
        cache: `${homeDir}/.cache/stargazer/v1`,
      },
    };
  }, []);

  useInput(
    (input, key) => {
      if (key.escape || input === "b") {
        onBack();
        return;
      }

      if (key.leftArrow) {
        setFocusedButton((prev) => (prev > 0 ? prev - 1 : ACTION_BUTTONS.length - 1));
        return;
      }

      if (key.rightArrow) {
        setFocusedButton((prev) => (prev < ACTION_BUTTONS.length - 1 ? prev + 1 : 0));
        return;
      }

      if (key.return) {
        const button = ACTION_BUTTONS[focusedButton];
        if (button) {
          handleButtonActivate(button.id);
        }
      }
    },
    { isActive }
  );

  const handleButtonActivate = (id: ButtonId): void => {
    switch (id) {
      case "print":
        setStatusMessage(`Config: ${systemInfo.paths.config} | Data: ${systemInfo.paths.data}`);
        break;
      case "export":
        setStatusMessage(`Debug report: ${systemInfo.appVersion}, Node ${systemInfo.nodeVersion}, ${systemInfo.terminalSize}`);
        break;
      case "reset":
        setStatusMessage("UI settings reset to defaults.");
        break;
    }
  };

  return (
    <Box flexDirection="column" padding={1} alignItems="center" justifyContent="center">
      <Box width={panelWidth}>
        <Panel>
          <PanelHeader value={systemInfo.appVersion} valueVariant="muted">
            System Diagnostics
          </PanelHeader>

          <PanelContent>
            {/* Info Grid - 2 columns */}
            <Box flexDirection="column" gap={1}>
              {/* Row 1: Version Info | Terminal Environment */}
              <Box>
                <Box width="50%" flexDirection="column">
                  <Text dimColor>VERSION INFO</Text>
                  <Box gap={1}>
                    <Text color="blue">Stargazer {systemInfo.appVersion}</Text>
                    <Text dimColor>|</Text>
                    <Text color="green">Node {systemInfo.nodeVersion}</Text>
                  </Box>
                </Box>
                <Box width="50%" flexDirection="column">
                  <Text dimColor>TERMINAL ENVIRONMENT</Text>
                  <Box gap={1}>
                    <Text>TTY </Text>
                    <Text color={systemInfo.isTTY ? "green" : "red"}>[{systemInfo.isTTY ? "Yes" : "No"}]</Text>
                    <Text dimColor>|</Text>
                    <Text>{systemInfo.terminalSize}</Text>
                    <Text dimColor>|</Text>
                    <Text>Color </Text>
                    <Text color="magenta">[{systemInfo.colorDepth}]</Text>
                  </Box>
                </Box>
              </Box>

              {/* Row 2: Unicode Support | Memory Usage */}
              <Box>
                <Box width="50%" flexDirection="column">
                  <Text dimColor>UNICODE SUPPORT</Text>
                  <Box gap={1}>
                    <Text>[{systemInfo.unicode.label}]</Text>
                    <Text color="yellow">✔ ✖ ▲ ●</Text>
                  </Box>
                </Box>
                <Box width="50%" flexDirection="column">
                  <Text dimColor>MEMORY USAGE</Text>
                  <Text>RSS: {systemInfo.rss} / Heap: {systemInfo.heap}</Text>
                </Box>
              </Box>
            </Box>

            <PanelDivider />

            {/* Storage Paths */}
            <Box flexDirection="column">
              <Text color="magenta" bold>STORAGE PATHS</Text>
              <Box flexDirection="column" marginTop={1}>
                <Box>
                  <Box width={10}><Text dimColor>Config:</Text></Box>
                  <Text>{systemInfo.paths.config}</Text>
                </Box>
                <Box>
                  <Box width={10}><Text dimColor>Data:</Text></Box>
                  <Text>{systemInfo.paths.data}</Text>
                </Box>
                <Box>
                  <Box width={10}><Text dimColor>Cache:</Text></Box>
                  <Text>{systemInfo.paths.cache}</Text>
                </Box>
              </Box>
            </Box>

            <PanelDivider />

            {/* Action Buttons */}
            <Box gap={2}>
              {ACTION_BUTTONS.map((button, idx) => {
                const isFocused = focusedButton === idx;
                const isLast = idx === ACTION_BUTTONS.length - 1;

                return (
                  <Box
                    key={button.id}
                    flexGrow={isLast ? 1 : 0}
                    justifyContent={isLast ? "flex-end" : "flex-start"}
                  >
                    <Box
                      borderStyle="single"
                      borderColor={isFocused ? button.focusColor : undefined}
                      paddingX={1}
                    >
                      <Text color={isFocused ? button.focusColor : undefined}>
                        [ {button.label} ]
                      </Text>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {statusMessage && (
              <Box marginTop={1}>
                <Text dimColor>{statusMessage}</Text>
              </Box>
            )}
          </PanelContent>
        </Panel>
      </Box>
    </Box>
  );
}
