import { Command } from "commander";
import { withErrorHandler } from "../with-error-handler.js";
import { type RunDiffWorkflowOptions, runDiffWorkflow } from "../workflows/diff.js";
import { resolveCwd, type SharedCommandOptions } from "./command-options.js";

// itemPlural names the command surface (description, argument), not the diff
// summary, which counts files.
export type DiffCommandConfig<TConfig> = Omit<
  RunDiffWorkflowOptions<TConfig>,
  "cwd" | "requestedNames"
> & { itemPlural: string };

function buildDiffAction<TConfig>(config: DiffCommandConfig<TConfig>) {
  return withErrorHandler(async (names: string[], opts: SharedCommandOptions) => {
    runDiffWorkflow({ ...config, cwd: resolveCwd(opts), requestedNames: names });
  });
}

export function createDiffCommand<TConfig>(config: DiffCommandConfig<TConfig>): Command {
  return new Command("diff")
    .description(`Compare local ${config.itemPlural} with registry versions`)
    .argument(`[${config.itemPlural}...]`, `${config.itemPlural} to diff`)
    .option("--cwd <path>", "Working directory", ".")
    .action(buildDiffAction(config));
}
