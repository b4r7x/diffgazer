import {
  createInitCommand,
  heading,
  installDepsWithSpinner,
  showSkippedDependencies,
} from "@diffgazer/registry/cli";
import { ctx, getRegistry } from "../../context.js";
import { buildStylesContent } from "../../utils/css-chunks.js";
import { withProjectMutationLock } from "../../utils/mutation-lock.js";
import { resolveInstallPath } from "../../utils/paths.js";
import { buildInitPlannedPaths, detectInitProject, initPlan } from "./plan.js";
import { createDirs, INIT_DEPENDENCIES, UTILS_CONTENT, writeFileResult } from "./scaffold.js";
import { validateReinitializeTopology, writeInitConfig } from "./topology.js";

export const initCommand = createInitCommand({
  configFileName: "diffgazer.json",
  loadConfig: ctx.config.loadConfig,
  dependencies: INIT_DEPENDENCIES,
  onSkipInstall: (dependencies) => showSkippedDependencies(dependencies, "--skip-install"),
  validateReinitialize: validateReinitializeTopology,
  withLock: withProjectMutationLock,
  extraOptions: [
    {
      flags: "--components-dir <path>",
      description: "Component install directory (default: <source dir>/components/ui)",
    },
    {
      flags: "--allow-missing-alias",
      description: "Initialize even when the app has no TypeScript/bundler source alias",
    },
    {
      flags: "--import-alias-prefix <prefix>",
      description:
        "Import alias prefix to use with --allow-missing-alias when detection fails (for example @ or ~)",
    },
    {
      flags: "--source-dir <path>",
      description:
        "Source directory to use with --allow-missing-alias when detection fails (for example client or src)",
    },
    {
      flags: "--reset-manifest",
      description:
        "Recovery only: discard the installed-item ownership ledger, orphaning previously installed files",
    },
  ],
  detectProject: detectInitProject,
  plannedPaths: (cwd, opts) => buildInitPlannedPaths(cwd, opts),
  createFiles: (cwd, opts) => {
    const { componentsDir, libDir, stylesDir, hooksDir } = initPlan(cwd, opts);
    const registry = getRegistry();

    return [
      ...createDirs(cwd, componentsDir, hooksDir),
      writeFileResult(
        resolveInstallPath(cwd, libDir, "utils.ts"),
        UTILS_CONTENT,
        `${libDir}/utils.ts`,
      ),
      writeFileResult(
        resolveInstallPath(cwd, stylesDir, "theme.css"),
        registry.theme,
        `${stylesDir}/theme.css`,
      ),
      writeFileResult(
        resolveInstallPath(cwd, stylesDir, "styles.css"),
        buildStylesContent(registry),
        `${stylesDir}/styles.css`,
      ),
    ];
  },
  // Throw on install failure so the workflow rolls back the freshly created files
  // and config instead of leaving a written diffgazer.json with missing deps.
  afterFiles: async (cwd, opts, abortSignal) => {
    const { project } = initPlan(cwd, opts);
    heading("Installing dependencies...");
    const ok = await installDepsWithSpinner(
      project.packageManager,
      INIT_DEPENDENCIES,
      cwd,
      abortSignal,
    );
    if (!ok) {
      throw new Error(
        "Failed to install dependencies (class-variance-authority, clsx, tailwind-merge). " +
          "Re-run with --skip-install to write files without installing, then install them manually.",
      );
    }
  },
  writeConfig: (cwd, opts) => writeInitConfig(cwd, opts),
  nextSteps: [
    "Add @import './styles/styles.css' to your main CSS file.",
    "Then add items with: dgadd add ui/button or dgadd add keys/navigation.",
  ],
});
