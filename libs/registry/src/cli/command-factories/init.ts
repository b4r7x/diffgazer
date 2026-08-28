import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import type { ConfigLoadResult } from "../config.js";
import { withErrorHandler } from "../with-error-handler.js";
import { runInitWorkflow } from "../workflows/init/workflow.js";
import {
  addExtraOptions,
  type ExtraOption,
  resolveCwd,
  type SharedCommandOptions,
} from "./command-options.js";

function readParseableConfigObject(
  configFileName: string,
  cwd: string,
): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(resolve(cwd, configFileName), "utf-8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function resolveExistingConfigForReinitializeValidation<TConfig>(
  configFileName: string,
  cwd: string,
  existing: ConfigLoadResult<TConfig>,
  resetManifest: boolean,
): TConfig | undefined {
  if (resetManifest) return undefined;
  if (existing.ok) return existing.config;
  if (existing.error !== "validation_error") return undefined;

  const raw = readParseableConfigObject(configFileName, cwd);
  return raw ? (raw as TConfig) : undefined;
}

export interface InitCommandConfig<TConfig> {
  configFileName: string;
  loadConfig: (cwd: string) => import("../config.js").ConfigLoadResult<TConfig>;
  detectProject: (
    cwd: string,
    opts: SharedCommandOptions,
  ) => { display: Array<[label: string, value: string]> };
  /**
   * Declare every path `createFiles`, `afterFiles`, and `writeConfig` may touch
   * (directories end with `/`); the workflow snapshots only these for rollback.
   * MUST include install side-effect files (e.g. `package.json`, the lockfile)
   * or a later `writeConfig` failure silently leaks package-manager mutations.
   */
  plannedPaths: (cwd: string, opts: SharedCommandOptions) => string[];
  createFiles: (
    cwd: string,
    opts: SharedCommandOptions,
  ) => Array<{ action: "created" | "skipped"; path: string }>;
  afterFiles?: (
    cwd: string,
    opts: SharedCommandOptions,
    abortSignal?: AbortSignal,
  ) => Promise<void>;
  dependencies: string[];
  onSkipInstall: (dependencies: string[]) => void;
  writeConfig: (cwd: string, opts: SharedCommandOptions) => void | Promise<void>;
  nextSteps: string[];
  validateReinitialize?: (context: {
    cwd: string;
    existingConfig: TConfig;
    options: SharedCommandOptions;
  }) => void | Promise<void>;
  withLock?: <T>(cwd: string, operation: () => Promise<T>) => Promise<T>;
  extraOptions?: ExtraOption[];
}

function buildInitAction<TConfig>(config: InitCommandConfig<TConfig>) {
  return withErrorHandler(async (opts: SharedCommandOptions) => {
    const cwd = resolveCwd(opts);
    const { afterFiles } = config;
    const run = async () => {
      if (opts.force && config.validateReinitialize) {
        const existing = config.loadConfig(cwd);
        const existingConfig = resolveExistingConfigForReinitializeValidation(
          config.configFileName,
          cwd,
          existing,
          opts.resetManifest === true,
        );
        if (existingConfig) {
          await config.validateReinitialize({
            cwd,
            existingConfig,
            options: opts,
          });
        }
      }

      await runInitWorkflow({
        cwd,
        yes: opts.yes ?? false,
        force: opts.force ?? false,
        dryRun: opts.dryRun ?? false,
        skipInstall: opts.skipInstall ?? false,
        configFileName: config.configFileName,
        loadConfig: config.loadConfig,
        detectProject: (cwd) => config.detectProject(cwd, opts),
        plannedPaths: (cwd) => config.plannedPaths(cwd, opts),
        createFiles: (cwd) => config.createFiles(cwd, opts),
        afterFiles: afterFiles && ((cwd, signal) => afterFiles(cwd, opts, signal)),
        dependencies: config.dependencies,
        onSkipInstall: config.onSkipInstall,
        writeConfig: (cwd) => config.writeConfig(cwd, opts),
        nextSteps: config.nextSteps,
      });
    };
    await (config.withLock ? config.withLock(cwd, run) : run());
  });
}

export function createInitCommand<TConfig>(config: InitCommandConfig<TConfig>): Command {
  const cmd = new Command("init")
    .description("Initialize project configuration")
    .option("--cwd <path>", "Working directory", ".")
    .option("-y, --yes", "Skip confirmation prompts", false)
    .option("--force", "Overwrite existing configuration", false)
    .option("--dry-run", "Preview initialization without writing files", false)
    .option("--skip-install", "Write files without installing npm dependencies", false);

  addExtraOptions(cmd, config.extraOptions);
  cmd.action(buildInitAction(config));
  return cmd;
}
