import { Command } from "commander";
import { withErrorHandler } from "../with-error-handler.js";
import { type AddWorkflowPlan, runAddWorkflow } from "../workflows/add.js";
import {
  addExtraOptions,
  type ExtraOption,
  resolveCwd,
  type SharedCommandOptions,
} from "./command-options.js";

export interface AddCommandConfig<TConfig> {
  itemLabel: string;
  itemPlural: string;
  listCommand: string;
  emptyRequestedMessage: string;
  allIgnoresSpecifiedWarning?: string;
  requireConfig: (cwd: string) => TConfig;
  getPublicNames: (ctx: { cwd: string; config: TConfig }) => string[];
  validateRequestedNames?: (names: string[]) => void;
  buildPlan: (ctx: {
    cwd: string;
    config: TConfig;
    names: string[];
    all: boolean;
    opts: SharedCommandOptions;
  }) => Promise<AddWorkflowPlan> | AddWorkflowPlan;
  withLock?: <T>(cwd: string, operation: () => Promise<T>) => Promise<T>;
  extraOptions?: ExtraOption[];
}

function buildAddAction<TConfig>(config: AddCommandConfig<TConfig>) {
  return withErrorHandler(async (names: string[], opts: SharedCommandOptions) => {
    const cwd = resolveCwd(opts);
    const run = () =>
      runAddWorkflow({
        cwd,
        requestedNames: names,
        all: opts.all ?? false,
        yes: opts.yes ?? false,
        dryRun: opts.dryRun ?? false,
        overwrite: opts.overwrite ?? false,
        skipInstall: opts.skipInstall ?? false,
        itemLabel: config.itemLabel,
        itemPlural: config.itemPlural,
        listCommand: config.listCommand,
        emptyRequestedMessage: config.emptyRequestedMessage,
        allIgnoresSpecifiedWarning: config.allIgnoresSpecifiedWarning,
        requireConfig: config.requireConfig,
        getPublicNames: config.getPublicNames,
        validateRequestedNames: config.validateRequestedNames,
        buildPlan: (ctx) => config.buildPlan({ ...ctx, opts }),
      });
    await (config.withLock ? config.withLock(cwd, run) : run());
  });
}

export function createAddCommand<TConfig>(config: AddCommandConfig<TConfig>): Command {
  const cmd = new Command("add")
    .description(`Add ${config.itemPlural} to your project`)
    .argument(`[${config.itemPlural}...]`, `${config.itemLabel} names to add`)
    .option("--cwd <path>", "Working directory", ".")
    .option("--all", `Add all ${config.itemPlural}`, false)
    .option("--overwrite", "Overwrite existing files", false)
    .option("--dry-run", "Preview changes without writing files", false)
    .option("--skip-install", "Write files without installing npm dependencies", false)
    .option("-y, --yes", "Skip confirmation prompts", false);

  addExtraOptions(cmd, config.extraOptions);
  cmd.action(buildAddAction(config));
  return cmd;
}
