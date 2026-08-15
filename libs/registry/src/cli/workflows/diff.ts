import { existsSync, readFileSync } from "node:fs";
import { createTwoFilesPatch } from "diff";
import pc from "picocolors";
import { sanitizeTerminalText } from "../sanitize-terminal.js";
import { heading, info, isSilentMode, newline } from "../terminal.js";

export type DiffWorkflowFile = {
  itemName: string;
  relativePath: string;
  registryContent: string;
} & ({ localPath: string } | { localContent: string });

function renderDiffPatch(file: DiffWorkflowFile, localContent: string): void {
  if (isSilentMode()) return;
  const label = sanitizeTerminalText(`${file.itemName}/${file.relativePath}`);
  heading(label);
  const patch = createTwoFilesPatch(
    `upstream/${file.relativePath}`,
    `local/${file.relativePath}`,
    file.registryContent,
    localContent,
    "upstream",
    "local",
  );

  const diffColors: Record<string, (value: string) => string> = {
    "+": pc.green,
    "-": pc.red,
    "@": pc.cyan,
  };
  for (const line of patch.split("\n")) {
    const safeLine = sanitizeTerminalText(line);
    const prefix = safeLine[0];
    const color = prefix && diffColors[prefix];
    const isHeader = safeLine.startsWith("+++") || safeLine.startsWith("---");
    console.log(color && !isHeader ? color(safeLine) : safeLine);
  }
}

type DiffScanContext<TScanContext> = TScanContext extends undefined ? undefined : TScanContext;

export interface RunDiffWorkflowOptions<TConfig, TScanContext = undefined> {
  cwd: string;
  requestedNames: string[];
  requireConfig: (cwd: string) => TConfig;
  createScanContext?: (ctx: { cwd: string; config: TConfig }) => TScanContext;
  resolveDefaultNames: (ctx: {
    cwd: string;
    config: TConfig;
    scan: DiffScanContext<TScanContext>;
  }) => string[];
  validateRequestedNames: (
    names: string[],
    ctx: { cwd: string; config: TConfig; scan: DiffScanContext<TScanContext> },
  ) => void;
  resolveFilesForName: (ctx: {
    name: string;
    cwd: string;
    config: TConfig;
    scan: DiffScanContext<TScanContext>;
  }) => DiffWorkflowFile[];
  noInstalledMessage: string;
  upToDateMessage: string;
}

interface DiffCounts {
  changed: number;
  unchanged: number;
  notInstalled: number;
}

function resolveNames<TConfig, TScanContext>(
  options: RunDiffWorkflowOptions<TConfig, TScanContext>,
  config: TConfig,
  scan: DiffScanContext<TScanContext>,
): string[] | null {
  const ctx = { cwd: options.cwd, config, scan };
  if (options.requestedNames.length > 0) {
    options.validateRequestedNames(options.requestedNames, ctx);
    return options.requestedNames;
  }

  const names = options.resolveDefaultNames(ctx);
  if (names.length === 0) {
    info(options.noInstalledMessage);
    return null;
  }
  return names;
}

function readLocalContent(file: DiffWorkflowFile): string | null {
  if ("localContent" in file) return file.localContent;
  if (!existsSync(file.localPath)) return null;
  return readFileSync(file.localPath, "utf-8");
}

function diffFile(file: DiffWorkflowFile): "not-installed" | "unchanged" | "changed" {
  const localContent = readLocalContent(file);
  if (localContent === null) {
    const item = sanitizeTerminalText(file.itemName);
    const rel = sanitizeTerminalText(file.relativePath);
    info(`${pc.dim(`${item}/`)}${rel}: ${pc.yellow("not installed")}`);
    return "not-installed";
  }

  if (localContent === file.registryContent) return "unchanged";

  renderDiffPatch(file, localContent);
  return "changed";
}

// The counters are per file, not per item: one item can contribute several files.
function printSummary(counts: DiffCounts, upToDateMessage: string): void {
  newline();
  if (counts.changed === 0 && counts.notInstalled === 0) {
    info(upToDateMessage);
    return;
  }

  const parts: string[] = [];
  if (counts.changed > 0) parts.push(`${counts.changed} changed`);
  if (counts.unchanged > 0) parts.push(`${counts.unchanged} unchanged`);
  if (counts.notInstalled > 0) parts.push(`${counts.notInstalled} not installed`);
  info(`Summary: ${parts.join(", ")} file(s).`);
}

export function runDiffWorkflow<TConfig, TScanContext = undefined>(
  options: RunDiffWorkflowOptions<TConfig, TScanContext>,
): void {
  const config = options.requireConfig(options.cwd);
  const scan = (options.createScanContext?.({ cwd: options.cwd, config }) ??
    undefined) as DiffScanContext<TScanContext>;

  const names = resolveNames(options, config, scan);
  if (!names) return;

  const counts: DiffCounts = { changed: 0, unchanged: 0, notInstalled: 0 };

  for (const name of names) {
    const files = options.resolveFilesForName({ name, cwd: options.cwd, config, scan });
    for (const file of files) {
      const result = diffFile(file);
      counts[result === "not-installed" ? "notInstalled" : result]++;
    }
  }

  printSummary(counts, options.upToDateMessage);
}
