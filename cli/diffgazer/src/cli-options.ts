import { parseArgs } from "node:util";
import type { CliMode } from "./types/cli.js";

export const HELP_TEXT = `Usage: diffgazer [options]

Product CLI for reviewing code changes with Diffgazer.

Options:
  --dev              Run in development mode
  --tui              Start the beta terminal UI (incomplete; not recommended)
  --theme <theme>    Start TUI with a specific theme (only with --tui)
  -V, --version      Display version
  -h, --help         Display help
`;

const CLI_OPTIONS = {
  dev: { type: "boolean" },
  tui: { type: "boolean" },
  theme: { type: "string" },
  version: { type: "boolean", short: "V" },
  help: { type: "boolean", short: "h" },
} as const;

export type CliAction =
  | { type: "help" }
  | { type: "version" }
  | { type: "web"; mode: CliMode; openBrowser: true }
  | { type: "tui"; mode: CliMode; theme?: string; openBrowser: false };

export function resolveCliAction(args: string[]): CliAction {
  const { values } = parseArgs({
    args,
    options: CLI_OPTIONS,
    allowPositionals: false,
  });

  if (values.help === true) {
    return { type: "help" };
  }

  if (values.version === true) {
    return { type: "version" };
  }

  const mode: CliMode = values.dev === true ? "dev" : "prod";

  if (typeof values.theme === "string" && values.tui !== true) {
    throw new Error("--theme requires --tui.");
  }

  if (values.tui === true) {
    const theme = typeof values.theme === "string" ? values.theme : undefined;
    return { type: "tui", mode, theme, openBrowser: false };
  }

  return { type: "web", mode, openBrowser: true };
}
