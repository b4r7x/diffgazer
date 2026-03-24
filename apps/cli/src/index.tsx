#!/usr/bin/env node

import { render } from "ink";
import { App } from "./app/index.js";
import type { CliMode } from "./types/cli.js";

function parseArgs(args: string[]): { mode: CliMode; theme?: string } {
  const mode: CliMode = args.includes("--dev") ? "dev" : "prod";
  const themeIdx = args.indexOf("--theme");
  const theme = themeIdx !== -1 ? args[themeIdx + 1] : undefined;
  return { mode, theme };
}

const { mode, theme } = parseArgs(process.argv.slice(2));
process.env.DIFFGAZER_CLI_PID ??= String(process.pid);

render(<App mode={mode} theme={theme} />, { exitOnCtrlC: false });
