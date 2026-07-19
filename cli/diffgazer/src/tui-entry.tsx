import { render } from "ink";
import type { CliMode } from "./cli-options";
import { ensureShutdownToken } from "./lib/shutdown-token";
import { createTerminalInputBoundary } from "./lib/terminal-input";

interface TuiOptions {
  mode: CliMode;
  theme?: string;
}

export async function startTui(options: TuiOptions): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write("The TUI requires an interactive terminal (TTY).\n");
    process.exitCode = 1;
    return;
  }

  ensureShutdownToken();
  const { App } = await import("./app/root");
  const terminalInput = createTerminalInputBoundary(process.stdin);

  try {
    const instance = render(
      <App mode={options.mode} theme={options.theme} terminalInputQueue={terminalInput.queue} />,
      {
        stdin: terminalInput.stdin,
        exitOnCtrlC: false,
        alternateScreen: true,
        incrementalRendering: true,
      },
    );
    void instance.waitUntilExit().then(terminalInput.dispose, terminalInput.dispose);
  } catch (error) {
    terminalInput.dispose();
    throw error;
  }
}
