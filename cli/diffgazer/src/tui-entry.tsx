import { render } from "ink";
import { ensureShutdownToken } from "./lib/shutdown-token.js";
import type { CliMode } from "./types/cli.js";

interface TuiOptions {
  mode: CliMode;
  theme?: string;
}

export async function startTui(options: TuiOptions): Promise<void> {
  ensureShutdownToken();
  const { App } = await import("./app/index.js");

  render(
    <App mode={options.mode} theme={options.theme} openBrowser={false} />,
    { exitOnCtrlC: false },
  );
}
