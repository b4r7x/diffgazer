import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getErrorMessage } from "@diffgazer/core/errors";
import { z } from "zod";
import { buildCliChildEnvironment } from "../../../../shared/lib/child-environment.js";
import { formatSchemaIssues } from "../../../../shared/lib/errors.js";
import { executableCandidateNames } from "../../../../shared/lib/executable-candidates.js";
import { readFileDirectory } from "../directory.js";
import { readPackageManifest } from "./manifest.js";

export type WorkspacePackage = {
  name: string;
  dir: string;
  kind: "app" | "package";
  dependencies: string[];
};

type WorkspaceRoot = {
  dir: string;
  kind: WorkspacePackage["kind"];
};

export interface WorkspaceDiscoveryOptions {
  runPnpmList?: (projectPath: string) => Promise<string>;
}

const execFileAsync = promisify(execFile);
const PNPM_LIST_TIMEOUT_MS = 10_000;
const PNPM_LIST_MAX_BUFFER_BYTES = 4 * 1024 * 1024;
const PNPM_LIST_ARGS = ["--recursive", "--depth", "-1", "list", "--json"] as const;

const PnpmWorkspaceListSchema = z
  .array(
    z.object({
      path: z.string().min(1),
    }),
  )
  .min(1);

const FALLBACK_WORKSPACE_ROOTS: WorkspaceRoot[] = [
  { dir: "apps", kind: "app" },
  { dir: "packages", kind: "package" },
];

async function isRealpathContained(
  absolutePath: string,
  normalizedProject: string,
): Promise<boolean> {
  const real = await realpath(absolutePath).catch(() => path.resolve(absolutePath));
  return real === normalizedProject || real.startsWith(normalizedProject + path.sep);
}

async function filterEscapedRoots(
  roots: WorkspaceRoot[],
  normalizedProject: string,
): Promise<WorkspaceRoot[]> {
  const results: WorkspaceRoot[] = [];
  for (const root of roots) {
    const resolved = path.resolve(normalizedProject, root.dir);
    if (await isRealpathContained(resolved, normalizedProject)) {
      results.push(root);
    }
  }
  return results;
}

async function hasPnpmWorkspace(projectPath: string): Promise<boolean> {
  try {
    await access(path.join(projectPath, "pnpm-workspace.yaml"));
    return true;
  } catch (error) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/**
 * Resolves `command` against PATH only. The reviewed repository is the child's
 * working directory, so a bare command name would let a `pnpm` planted at its
 * root run instead — cmd.exe searches the working directory before PATH.
 */
async function resolveExecutableOnPath(command: string): Promise<string | null> {
  const searchDirs = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter((dir) => dir.length > 0 && path.isAbsolute(dir));
  const names = executableCandidateNames(command);

  for (const dir of searchDirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      const candidateStat = await stat(candidate).catch(() => null);
      if (!candidateStat?.isFile()) continue;
      const isExecutable = await access(candidate, constants.X_OK).then(
        () => true,
        () => false,
      );
      if (isExecutable) return candidate;
    }
  }
  return null;
}

async function runPnpmWorkspaceList(projectPath: string): Promise<string> {
  const pnpmPath = await resolveExecutableOnPath("pnpm");
  if (!pnpmPath) {
    throw new Error("pnpm was not found on PATH");
  }

  // The child runs inside the reviewed repository, so it gets the same narrowed
  // environment as a provider CLI: never the shutdown token or a provider key.
  const childEnv = buildCliChildEnvironment();

  // npm/corepack installs of pnpm on Windows are `pnpm.cmd` shims, and Node
  // refuses to spawn batch files without a shell. Route through cmd.exe with the
  // resolved absolute path, wrapped in the outer quote pair `/s` strips, instead
  // of enabling shell interpolation.
  const isWindows = process.platform === "win32";
  const { stdout } = await execFileAsync(
    isWindows ? "cmd.exe" : pnpmPath,
    isWindows
      ? ["/d", "/s", "/c", `""${pnpmPath}" ${PNPM_LIST_ARGS.join(" ")}"`]
      : [...PNPM_LIST_ARGS],
    {
      cwd: projectPath,
      env: { ...childEnv, CI: "1", npm_config_offline: "true" },
      timeout: PNPM_LIST_TIMEOUT_MS,
      maxBuffer: PNPM_LIST_MAX_BUFFER_BYTES,
      windowsHide: true,
      windowsVerbatimArguments: isWindows,
    },
  );
  return stdout;
}

function parsePnpmWorkspaceList(stdout: string): Array<{ path: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`pnpm workspace list returned invalid JSON: ${getErrorMessage(error)}`);
  }

  const result = PnpmWorkspaceListSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `pnpm workspace list returned an invalid shape: ${formatSchemaIssues(result.error)}`,
    );
  }
  return result.data;
}

function workspaceKind(dir: string): WorkspacePackage["kind"] {
  const firstSegment = dir.split("/")[0];
  return firstSegment === "app" || firstSegment === "apps" ? "app" : "package";
}

function collectDependencies(pkgJson: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}): string[] {
  const deps = new Set<string>();
  for (const group of [pkgJson.dependencies, pkgJson.devDependencies, pkgJson.peerDependencies]) {
    for (const dep of Object.keys(group ?? {})) {
      deps.add(dep);
    }
  }
  return Array.from(deps);
}

async function readWorkspacePackage(
  projectPath: string,
  dir: string,
  kind: WorkspacePackage["kind"],
  normalizedProject: string,
): Promise<WorkspacePackage | null> {
  const manifestPath = path.join(projectPath, dir, "package.json");
  if (!(await isRealpathContained(manifestPath, normalizedProject))) return null;

  const pkgJson = await readPackageManifest(manifestPath);
  if (!pkgJson?.name) return null;

  return {
    name: pkgJson.name,
    dir,
    kind,
    dependencies: collectDependencies(pkgJson),
  };
}

export async function discoverWorkspacePackages(
  projectPath: string,
  options: WorkspaceDiscoveryOptions = {},
): Promise<WorkspacePackage[]> {
  const normalizedProject = await realpath(projectPath).catch(() => path.resolve(projectPath));

  const packages: WorkspacePackage[] = [];
  const seenPackageDirs = new Set<string>();
  const addPackage = (pkg: WorkspacePackage | null): void => {
    if (!pkg) return;
    const packageDir = path.resolve(projectPath, pkg.dir);
    if (seenPackageDirs.has(packageDir)) return;
    seenPackageDirs.add(packageDir);
    packages.push(pkg);
  };

  if (await hasPnpmWorkspace(projectPath)) {
    let stdout: string;
    try {
      stdout = await (options.runPnpmList ?? runPnpmWorkspaceList)(projectPath);
    } catch (error) {
      throw new Error(
        `Failed to resolve pnpm workspace with the local pnpm CLI: ${getErrorMessage(error)}`,
      );
    }

    for (const project of parsePnpmWorkspaceList(stdout)) {
      const absoluteDir = path.isAbsolute(project.path)
        ? project.path
        : path.resolve(projectPath, project.path);
      let realDir: string;
      try {
        realDir = await realpath(absoluteDir);
      } catch (error) {
        throw new Error(
          `pnpm workspace path cannot be resolved (${project.path}): ${getErrorMessage(error)}`,
        );
      }
      if (realDir !== normalizedProject && !realDir.startsWith(`${normalizedProject}${path.sep}`)) {
        continue;
      }

      const relativeDir =
        path.relative(normalizedProject, realDir).split(path.sep).join("/") || ".";
      addPackage(
        await readWorkspacePackage(
          normalizedProject,
          relativeDir,
          workspaceKind(relativeDir),
          normalizedProject,
        ),
      );
    }
    return packages;
  }

  const roots = await filterEscapedRoots(FALLBACK_WORKSPACE_ROOTS, normalizedProject);
  for (const root of roots) {
    const absoluteRoot = path.join(projectPath, root.dir);
    try {
      await access(absoluteRoot);
    } catch {
      continue;
    }

    const entries = await readFileDirectory(absoluteRoot);
    for (const entry of entries) {
      if (entry.kind !== "directory") continue;
      const childDir = path.join(root.dir, entry.name);
      if (!(await isRealpathContained(path.join(projectPath, childDir), normalizedProject))) {
        continue;
      }
      addPackage(await readWorkspacePackage(projectPath, childDir, root.kind, normalizedProject));
    }
  }

  return packages;
}
