import { Command } from "commander";
import { withErrorHandler } from "../with-error-handler.js";
import { runInitWorkflow } from "../workflows/init.js";
import {
  addExtraOptions,
  type ExtraOption,
  resolveCwd,
  type SharedCommandOptions,
} from "./shared.js";

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
  afterFiles?: (cwd: string) => Promise<void>;
  dependencies: string[];
  onSkipInstall: (dependencies: string[]) => void;
  writeConfig: (cwd: string, opts: SharedCommandOptions) => void | Promise<void>;
  nextSteps: string[];
  extraOptions?: ExtraOption[];
}

function buildInitAction<TConfig>(config: InitCommandConfig<TConfig>) {
  return withErrorHandler(async (opts: SharedCommandOptions) => {
    const cwd = resolveCwd(opts);
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
      afterFiles: config.afterFiles,
      dependencies: config.dependencies,
      onSkipInstall: config.onSkipInstall,
      writeConfig: (cwd) => config.writeConfig(cwd, opts),
      nextSteps: config.nextSteps,
    });
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
