import { info, newline } from "../terminal.js";

export interface ListDisplayItem {
  name: string;
  title?: string;
  description?: string;
  dependencies: string[];
  files: string[];
}

interface ListWorkflowFile {
  path: string;
}

interface ListWorkflowItem {
  name: string;
  title?: string;
  description?: string;
  dependencies: string[];
  files: ListWorkflowFile[];
}

export interface RunListWorkflowOptions<TItem extends ListWorkflowItem, TConfig> {
  cwd: string;
  includeAll: boolean;
  installedOnly: boolean;
  json: boolean;
  itemPlural: string;
  getRelativePath: (file: ListWorkflowFile) => string;
  getAllItems: () => TItem[];
  getPublicItems: () => TItem[];
  requireConfig: (cwd: string) => TConfig;
  isInstalled: (ctx: { cwd: string; config: TConfig; item: TItem }) => boolean;
}

function resolveItems<TItem extends ListWorkflowItem, TConfig>(
  options: RunListWorkflowOptions<TItem, TConfig>,
): TItem[] {
  const {
    cwd,
    includeAll,
    installedOnly,
    getAllItems,
    getPublicItems,
    requireConfig,
    isInstalled,
  } = options;

  const items = includeAll ? getAllItems() : getPublicItems();
  if (!installedOnly) return items;

  const config = requireConfig(cwd);
  return items.filter((item) => isInstalled({ cwd, config, item }));
}

function printEmptyMessage(installedOnly: boolean, itemPlural: string): void {
  newline();
  info(installedOnly ? `No installed ${itemPlural} found.` : `No ${itemPlural} available.`);
  newline();
}

function printTable(
  displayItems: ListDisplayItem[],
  installedOnly: boolean,
  itemPlural: string,
): void {
  const label = installedOnly ? "Installed" : "Available";
  newline();
  info(`${label} ${itemPlural} (${displayItems.length}):`);
  newline();

  const maxLen = Math.max(...displayItems.map((item) => item.name.length)) + 2;
  for (const item of displayItems) {
    info(`  ${item.name.padEnd(maxLen)} ${item.description ?? ""}`);
  }
  newline();
}

export function runListWorkflow<TItem extends ListWorkflowItem, TConfig>(
  options: RunListWorkflowOptions<TItem, TConfig>,
): void {
  const { json, installedOnly, itemPlural, getRelativePath } = options;

  const displayItems = resolveItems(options)
    .map(
      (item): ListDisplayItem => ({
        name: item.name,
        title: item.title,
        description: item.description,
        dependencies: item.dependencies,
        files: item.files.map(getRelativePath),
      }),
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  if (json) {
    console.log(JSON.stringify(displayItems, null, 2));
    return;
  }

  if (displayItems.length === 0) {
    printEmptyMessage(installedOnly, itemPlural);
    return;
  }

  printTable(displayItems, installedOnly, itemPlural);
}
