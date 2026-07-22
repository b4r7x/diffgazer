import { execFile } from "node:child_process";
import { access, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getErrorMessage } from "@diffgazer/core/errors";
import { z } from "zod";
import { readFileDirectory } from "../directory.js";
import { formatSchemaIssues, readPackageManifest } from "./manifest.js";

export type WorkspacePackage = {
  name: string;
  dir: string;
  kind: "app" | "package";
  dependencies: string[];
};

type WorkspaceRoot = {
  dir: string;
  kind: WorkspacePackage["kind"];
  includeSelf: boolean;
  includeChildren: boolean;
};

export interface WorkspaceDiscoveryOptions {
  runPnpmList?: (projectPath: string) => Promise<string>;
}

const execFileAsync = promisify(execFile);
const PNPM_LIST_TIMEOUT_MS = 10_000;
const PNPM_LIST_MAX_BUFFER_BYTES = 4 * 1024 * 1024;

const PnpmWorkspaceListSchema = z
  .array(
    z.object({
      path: z.string().min(1),
    }),
  )
  .min(1);

const FALLBACK_WORKSPACE_ROOTS: WorkspaceRoot[] = [
  { dir: "apps", kind: "app", includeSelf: false, includeChildren: true },
  { dir: "packages", kind: "package", includeSelf: false, includeChildren: true },
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

async function runPnpmWorkspaceList(projectPath: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["--recursive", "--depth", "-1", "list", "--json"],
    {
      cwd: projectPath,
      env: { ...process.env, CI: "1", npm_config_offline: "true" },
      timeout: PNPM_LIST_TIMEOUT_MS,
      maxBuffer: PNPM_LIST_MAX_BUFFER_BYTES,
      windowsHide: true,
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

    if (root.includeSelf) {
      addPackage(await readWorkspacePackage(projectPath, root.dir, root.kind, normalizedProject));
    }
    if (!root.includeChildren) continue;

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
