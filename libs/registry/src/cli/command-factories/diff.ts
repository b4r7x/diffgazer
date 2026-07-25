import { Command } from "commander";
import { withErrorHandler } from "../with-error-handler.js";
import { type DiffWorkflowFile, renderDiffPatch, runDiffWorkflow } from "../workflows/diff.js";
import { resolveCwd, type SharedCommandOptions } from "./shared.js";

export interface DiffCommandConfig<TConfig> {
  itemPlural: string;
  requireConfig: (cwd: string) => TConfig;
  resolveDefaultNames: (ctx: { cwd: string; config: TConfig }) => string[];
  validateRequestedNames: (names: string[]) => void;
  resolveFilesForName: (ctx: { name: string; cwd: string; config: TConfig }) => DiffWorkflowFile[];
  noInstalledMessage: string;
  upToDateMessage: string;
}

function buildDiffAction<TConfig>(config: DiffCommandConfig<TConfig>) {
  return withErrorHandler(async (names: string[], opts: SharedCommandOptions) => {
    const cwd = resolveCwd(opts);

    runDiffWorkflow({
      cwd,
      requestedNames: names,
      itemPlural: config.itemPlural,
      requireConfig: config.requireConfig,
      resolveDefaultNames: config.resolveDefaultNames,
      validateRequestedNames: config.validateRequestedNames,
      resolveFilesForName: config.resolveFilesForName,
      noInstalledMessage: config.noInstalledMessage,
      upToDateMessage: config.upToDateMessage,
      renderChangedFile: renderDiffPatch,
    });
  });
}

export function createDiffCommand<TConfig>(config: DiffCommandConfig<TConfig>): Command {
  return new Command("diff")
    .description(`Compare local ${config.itemPlural} with registry versions`)
    .argument(`[${config.itemPlural}...]`, `${config.itemPlural} to diff`)
    .option("--cwd <path>", "Working directory", ".")
    .action(buildDiffAction(config));
}
