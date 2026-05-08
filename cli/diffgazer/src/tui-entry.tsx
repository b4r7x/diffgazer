import { render } from "ink";
import { App } from "./app/index.js";
import type { CliMode } from "./types/cli.js";

interface TuiOptions {
  mode: CliMode;
  theme?: string;
}

export function startTui(options: TuiOptions): void {
  render(
    <App mode={options.mode} theme={options.theme} openBrowser={false} />,
    { exitOnCtrlC: false },
  );
}
