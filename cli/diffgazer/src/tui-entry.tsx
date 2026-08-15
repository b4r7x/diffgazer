import { render } from "ink";
import type { CliMode } from "./cli-options";
import { ensureShutdownToken } from "./lib/shutdown-token";
import { createTerminalInputBoundary } from "./lib/terminal-input";
import type { TuiThemeName } from "./theme/palettes";

interface TuiOptions {
  mode: CliMode;
  theme?: TuiThemeName;
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

  let instance: ReturnType<typeof render>;
  try {
    instance = render(
      <App mode={options.mode} theme={options.theme} terminalInputQueue={terminalInput.queue} />,
      {
        stdin: terminalInput.stdin,
        exitOnCtrlC: false,
        alternateScreen: true,
        incrementalRendering: true,
      },
    );
  } catch (error) {
    terminalInput.dispose();
    throw error;
  }

  try {
    await instance.waitUntilExit();
  } finally {
    terminalInput.dispose();
  }
}
