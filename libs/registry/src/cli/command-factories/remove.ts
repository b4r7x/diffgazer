import { Command } from "commander";
import { withErrorHandler } from "../with-error-handler.js";
import type { RunRemoveWorkflowOptions } from "../workflows/remove/types.js";
import { runRemoveWorkflow } from "../workflows/remove/workflow.js";
import { resolveCwd, type SharedCommandOptions } from "./command-options.js";

export type RemoveCommandConfig<TItem, TConfig, TMetadata = undefined> = Omit<
  RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>,
  "cwd" | "names" | "yes" | "dryRun" | "force"
> & {
  withLock?: <T>(cwd: string, operation: () => Promise<T>) => Promise<T>;
};

function buildRemoveAction<TItem, TConfig, TMetadata>(
  config: RemoveCommandConfig<TItem, TConfig, TMetadata>,
) {
  return withErrorHandler(async (names: string[], opts: SharedCommandOptions) => {
    const cwd = resolveCwd(opts);
    const run = () =>
      runRemoveWorkflow({
        ...config,
        cwd,
        names,
        yes: opts.yes ?? false,
        dryRun: opts.dryRun ?? false,
        force: opts.force ?? false,
      });
    await (config.withLock ? config.withLock(cwd, run) : run());
  });
}

export function createRemoveCommand<TItem, TConfig, TMetadata = undefined>(
  config: RemoveCommandConfig<TItem, TConfig, TMetadata>,
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
