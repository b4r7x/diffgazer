import { Command } from "commander";
import { withErrorHandler } from "../with-error-handler.js";
import type { RunRemoveWorkflowOptions } from "../workflows/remove/types.js";
import { runRemoveWorkflow } from "../workflows/remove/workflow.js";
import { resolveCwd, type SharedCommandOptions } from "./command-options.js";

export type RemoveCommandConfig<TItem, TConfig> = Omit<
  RunRemoveWorkflowOptions<TItem, TConfig>,
  "cwd" | "names" | "yes" | "dryRun" | "force"
>;

function buildRemoveAction<TItem, TConfig>(config: RemoveCommandConfig<TItem, TConfig>) {
  return withErrorHandler(async (names: string[], opts: SharedCommandOptions) => {
    await runRemoveWorkflow({
      ...config,
      cwd: resolveCwd(opts),
      names,
      yes: opts.yes ?? false,
      dryRun: opts.dryRun ?? false,
      force: opts.force ?? false,
    });
  });
}

export function createRemoveCommand<TItem, TConfig>(
  config: RemoveCommandConfig<TItem, TConfig>,
): Command {
  return new Command("remove")
    .description(`Remove ${config.itemPlural} from your project`)
    .argument(`<${config.itemPlural}...>`, `${config.itemPlural} to remove`)
    .option("--cwd <path>", "Working directory", ".")
    .option("-y, --yes", "Skip confirmation prompts", false)
    .option("--dry-run", "Preview changes without removing files", false)
    .option(
      "--force",
      "Remove files even when ownership metadata is missing or content changed",
      false,
    )
    .action(buildRemoveAction(config));
}
