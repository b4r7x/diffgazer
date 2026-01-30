import type { ReactElement } from "react";
import { useState, useMemo } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import os from "node:os";
import chalk from "chalk";
import { Panel, PanelHeader, PanelContent, PanelDivider } from "../../components/ui/panel.js";

interface SettingsDiagnosticsViewProps {
  onBack: () => void;
  isActive?: boolean;
}

const ACTION_BUTTONS = [
  { id: "print", label: "Print Paths", color: "blue" },
  { id: "export", label: "Export Debug Report", color: "green" },
  { id: "reset", label: "Reset UI Settings", color: "red" },
] as const;

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
  const { stdout } = useStdout();
  const panelWidth = Math.min(72, (stdout?.columns ?? 80) - 4);

  const [focusedButton, setFocusedButton] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const systemInfo = useMemo(() => {
    const mem = process.memoryUsage();
    const cols = process.stdout.columns ?? 80;
    const rows = process.stdout.rows ?? 24;
    const homeDir = os.homedir();

    return {
      appVersion: "v1.4.2",
      nodeVersion: process.version,
      terminalSize: `${cols}x${rows}`,
      isTTY: process.stdout.isTTY ?? false,
      colorDepth: getColorDepth(),
      unicode: getUnicodeSupport(),
      rss: formatBytes(mem.rss),
      heap: formatBytes(mem.heapUsed),
      paths: {
        config: `${homeDir}/.config/stargazer`,
        data: `${homeDir}/.local/share/stargazer/runs`,
        cache: `${homeDir}/.cache/stargazer/v1`,
      },
    };
  }, []);

  function handleButtonActivate(id: string): void {
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
  }

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

  return (
    <Box flexDirection="column" padding={1} alignItems="center" justifyContent="center">
      <Box width={panelWidth}>
        <Panel>
          <PanelHeader value={systemInfo.appVersion} valueVariant="muted">
            System Diagnostics
          </PanelHeader>

          <PanelContent>
            <Box flexDirection="column" gap={1}>
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

            <Box gap={2} justifyContent="space-between">
              {ACTION_BUTTONS.map((button, idx) => {
                const isFocused = focusedButton === idx;
                return (
                  <Box
                    key={button.id}
                    borderStyle="single"
                    borderColor={isFocused ? button.color : undefined}
                    paddingX={1}
                  >
                    <Text color={isFocused ? button.color : undefined}>
                      [ {button.label} ]
                    </Text>
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
