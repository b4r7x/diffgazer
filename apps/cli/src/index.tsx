#!/usr/bin/env node

import { render } from "ink";
import { App } from "./app/index.js";
import type { CliMode } from "./types/cli.js";

function parseCliMode(args: string[]): CliMode {
  return args.includes("--dev") ? "dev" : "prod";
}

const mode = parseCliMode(process.argv.slice(2));
process.env.DIFFGAZER_CLI_PID ??= String(process.pid);

render(<App mode={mode} />, { exitOnCtrlC: false });
