import { render } from "ink";
import { ensureShutdownToken } from "./lib/shutdown-token";
import type { CliMode } from "./types/cli";

interface TuiOptions {
  mode: CliMode;
  theme?: string;
}

export async function startTui(options: TuiOptions): Promise<void> {
  ensureShutdownToken();
  const { App } = await import("./app/index");

  render(
    <App mode={options.mode} theme={options.theme} openBrowser={false} />,
    { exitOnCtrlC: false },
  );
}
