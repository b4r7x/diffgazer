import { Command } from "commander";
import { withErrorHandler } from "../with-error-handler.js";
import type {
  DerivedRemovalPlan,
  ExpandRequestedNamesResult,
  RemoveWorkflowFile,
} from "../workflows/remove/types.js";
import { runRemoveWorkflow } from "../workflows/remove/workflow.js";
import { resolveCwd, type SharedCommandOptions } from "./shared.js";

export interface RemoveCommandConfig<TItem, TConfig> {
  itemPlural: string;
  requireConfig: (cwd: string) => TConfig;
  validateNames: (names: string[]) => void;
  getAllItems: () => TItem[];
  getItemOrThrow: (name: string) => TItem;
  getItemName: (item: TItem) => string;
  isInstalled: (ctx: { cwd: string; config: TConfig; item: TItem }) => boolean;
  resolveFilesForItem: (ctx: { cwd: string; config: TConfig; item: TItem }) => RemoveWorkflowFile[];
  canRemoveFile?: (ctx: {
    cwd: string;
    config: TConfig;
    item: TItem;
    file: RemoveWorkflowFile;
    force: boolean;
    requestedNames: string[];
  }) => boolean;
  resolveAllowedBaseDirs: (ctx: { cwd: string; config: TConfig }) => string[];
  resolveTransactionFiles?: (ctx: { cwd: string; config: TConfig }) => string[];
  updateManifest: (ctx: { cwd: string; removedNames: string[] }) => void;
  findOrphanedDeps?: (ctx: { removedNames: string[]; cwd: string; config: TConfig }) => string[];
  expandRequestedNames?: (ctx: {
    cwd: string;
    config: TConfig;
    names: string[];
  }) => ExpandRequestedNamesResult;
  onAfterRemove?: (ctx: {
    cwd: string;
    config: TConfig;
    removedNames: string[];
    force: boolean;
  }) => DerivedRemovalPlan | undefined;
}

function buildRemoveAction<TItem, TConfig>(config: RemoveCommandConfig<TItem, TConfig>) {
  return withErrorHandler(async (names: string[], opts: SharedCommandOptions) => {
    const cwd = resolveCwd(opts);

    await runRemoveWorkflow({
      cwd,
      names,
      yes: opts.yes ?? false,
      dryRun: opts.dryRun ?? false,
      force: opts.force ?? false,
      itemPlural: config.itemPlural,
      requireConfig: config.requireConfig,
      validateNames: config.validateNames,
      getAllItems: config.getAllItems,
      getItemOrThrow: config.getItemOrThrow,
      getItemName: config.getItemName,
      isInstalled: config.isInstalled,
      resolveFilesForItem: config.resolveFilesForItem,
      canRemoveFile: config.canRemoveFile,
      resolveAllowedBaseDirs: config.resolveAllowedBaseDirs,
      resolveTransactionFiles: config.resolveTransactionFiles,
      updateManifest: config.updateManifest,
      findOrphanedDeps: config.findOrphanedDeps,
      expandRequestedNames: config.expandRequestedNames,
      onAfterRemove: config.onAfterRemove,
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
