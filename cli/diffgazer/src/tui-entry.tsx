import { render } from "ink";
import type { CliMode } from "./cli-options";
import { ensureShutdownToken } from "./lib/shutdown-token";

interface TuiOptions {
  mode: CliMode;
  theme?: string;
}

export async function startTui(options: TuiOptions): Promise<void> {
  ensureShutdownToken();
  const { App } = await import("./app/root");

  render(<App mode={options.mode} theme={options.theme} openBrowser={false} />, {
    exitOnCtrlC: false,
  });
}
