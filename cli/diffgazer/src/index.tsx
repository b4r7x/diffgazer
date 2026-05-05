#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "ink";
import { App } from "./app/index.js";
import type { CliMode } from "./types/cli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HELP_TEXT = `Usage: diffgazer [options]

Product CLI for reviewing code changes with Diffgazer.

Options:
  --dev              Run in development mode
  --theme <theme>    Start with a specific theme
  -V, --version      Display version
  -h, --help         Display help
`;

function isHelp(args: string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

function isVersion(args: string[]): boolean {
  return args.includes("--version") || args.includes("-V");
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function parseArgs(args: string[]): { mode: CliMode; theme?: string } {
  const mode: CliMode = args.includes("--dev") ? "dev" : "prod";
  const themeIdx = args.indexOf("--theme");
  const theme = themeIdx !== -1 ? args[themeIdx + 1] : undefined;
  return { mode, theme };
}

const args = process.argv.slice(2);
if (isHelp(args)) {
  console.log(HELP_TEXT);
  process.exit(0);
}

if (isVersion(args)) {
  console.log(readVersion());
  process.exit(0);
}

const { mode, theme } = parseArgs(args);
process.env.DIFFGAZER_CLI_PID ??= String(process.pid);

render(<App mode={mode} theme={theme} />, { exitOnCtrlC: false });
