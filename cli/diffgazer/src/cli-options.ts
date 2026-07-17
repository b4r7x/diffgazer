import { parseArgs } from "node:util";
import { isTuiThemeName, TUI_THEME_NAMES, type TuiThemeName } from "./theme/palettes";

export type CliMode = "dev" | "prod";

export const HELP_TEXT = `Usage: diffgazer [options]

Review code changes with Diffgazer in your browser or terminal.

Options:
  --tui              Start the beta terminal UI (incomplete; not recommended)
  --theme <theme>    Start TUI with a theme: ${TUI_THEME_NAMES.join(", ")} (only with --tui)
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
  | { type: "tui"; mode: CliMode; theme?: TuiThemeName; openBrowser: false };

export function resolveCliAction(args: string[]): CliAction {
  const { values } = parseArgs({
    args,
    options: CLI_OPTIONS,
    allowPositionals: false,
  });

  if (values.help) {
    return { type: "help" };
  }

  if (values.version) {
    return { type: "version" };
  }

  const mode: CliMode = values.dev ? "dev" : "prod";

  if (typeof values.theme === "string" && !values.tui) {
    throw new Error("--theme requires --tui.");
  }

  if (values.tui) {
    const theme = typeof values.theme === "string" ? values.theme : undefined;
    if (theme !== undefined && !isTuiThemeName(theme)) {
      throw new Error(
        `Invalid --theme "${theme}". Expected one of: ${TUI_THEME_NAMES.join(", ")}.`,
      );
    }
    return { type: "tui", mode, theme, openBrowser: false };
  }

  return { type: "web", mode, openBrowser: true };
}
