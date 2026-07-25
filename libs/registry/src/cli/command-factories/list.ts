import { Command } from "commander";
import type { RegistryItem } from "../registry.js";
import { withErrorHandler } from "../with-error-handler.js";
import { runListWorkflow } from "../workflows/list.js";
import { resolveCwd, type SharedCommandOptions } from "./shared.js";

type RegistryLikeItem = Pick<
  RegistryItem,
  "name" | "title" | "description" | "dependencies" | "files"
>;

export interface ListCommandConfig<TItem extends RegistryLikeItem, TConfig> {
  itemPlural: string;
  getAllItems: () => TItem[];
  getPublicItems: () => TItem[];
  requireConfig: (cwd: string) => TConfig;
  createInstallChecker: (cwd: string, config: TConfig) => (name: string) => boolean;
  getRelativePath: (file: { path: string }) => string;
}

function buildListAction<TItem extends RegistryLikeItem, TConfig>(
  config: ListCommandConfig<TItem, TConfig>,
) {
  return withErrorHandler(async (opts: SharedCommandOptions) => {
    const cwd = resolveCwd(opts);
    let checker: ((name: string) => boolean) | undefined;

    runListWorkflow({
      cwd,
      includeAll: opts.all ?? false,
      installedOnly: opts.installed ?? false,
      json: opts.json ?? false,
      itemPlural: config.itemPlural,
      getRelativePath: config.getRelativePath,
      getAllItems: config.getAllItems,
      getPublicItems: config.getPublicItems,
      requireConfig: config.requireConfig,
      isInstalled: ({ cwd, config: cfg, item }) => {
        checker ??= config.createInstallChecker(cwd, cfg);
        return checker(item.name);
      },
    });
  });
}

export function createListCommand<TItem extends RegistryLikeItem, TConfig>(
  config: ListCommandConfig<TItem, TConfig>,
): Command {
  return new Command("list")
    .description(`List available ${config.itemPlural}`)
    .option("--cwd <path>", "Working directory", ".")
    .option("--json", "Output as JSON")
    .option("--installed", `Show only installed ${config.itemPlural}`)
    .option("--all", "Include hidden/internal items")
    .action(buildListAction(config));
}
