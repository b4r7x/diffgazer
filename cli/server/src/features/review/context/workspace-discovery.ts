import { access, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { getErrorMessage } from "@diffgazer/core/errors";
import { z } from "zod";
import { log } from "../../../shared/lib/log.js";

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

const PackageManifestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
});

export type PackageManifest = z.infer<typeof PackageManifestSchema>;

function formatSchemaIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export async function readPackageManifest(filePath: string): Promise<PackageManifest | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    log("warn", "context_manifest_unreadable", { filePath, error: getErrorMessage(error) });
    return null;
  }

  const result = PackageManifestSchema.safeParse(parsed);
  if (!result.success) {
    log("warn", "context_manifest_invalid", {
      filePath,
      issues: formatSchemaIssues(result.error),
    });
    return null;
  }

  return result.data;
}

export async function readFileDirectory(
  dirPath: string,
): Promise<Array<{ name: string; isDirectory: boolean }>> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
  } catch {
    return [];
  }
}

const FALLBACK_WORKSPACE_ROOTS: WorkspaceRoot[] = [
  { dir: "apps", kind: "app", includeSelf: false, includeChildren: true },
  { dir: "packages", kind: "package", includeSelf: false, includeChildren: true },
];

function parseWorkspaceYaml(content: string): string[] {
  const lines = content.split("\n");
  const globs: string[] = [];
  let inPackages = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "packages:" || trimmed.startsWith("packages:")) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      if (/^\w/.test(trimmed) && !trimmed.startsWith("-")) {
        break;
      }
      const match = trimmed.match(/^-\s+["']?([^"']+)["']?$/);
      if (match?.[1]) {
        globs.push(match[1]);
      }
    }
  }
  return globs;
}

function resolveWorkspaceRoots(globs: string[]): WorkspaceRoot[] {
  return globs.map((glob) => {
    const includeChildren = glob.endsWith("/*");
    const dir = includeChildren ? glob.replace(/\/\*$/, "") : glob;
    const kind: WorkspacePackage["kind"] = dir.startsWith("app") ? "app" : "package";
    return { dir, kind, includeSelf: !includeChildren, includeChildren };
  });
}

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

async function getWorkspaceRoots(
  projectPath: string,
  normalizedProject: string,
): Promise<WorkspaceRoot[]> {
  const yamlPath = path.join(projectPath, "pnpm-workspace.yaml");
  try {
    const content = await readFile(yamlPath, "utf8");
    const globs = parseWorkspaceYaml(content);
    if (globs.length > 0) {
      return await filterEscapedRoots(resolveWorkspaceRoots(globs), normalizedProject);
    }
  } catch {
    // pnpm-workspace.yaml not found — fall through to defaults
  }
  return await filterEscapedRoots(FALLBACK_WORKSPACE_ROOTS, normalizedProject);
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

export async function discoverWorkspacePackages(projectPath: string): Promise<WorkspacePackage[]> {
  const normalizedProject = await realpath(projectPath).catch(() => path.resolve(projectPath));
  const roots = await getWorkspaceRoots(projectPath, normalizedProject);

  const packages: WorkspacePackage[] = [];
  const seenPackageDirs = new Set<string>();
  const addPackage = (pkg: WorkspacePackage | null): void => {
    if (!pkg) return;
    const packageDir = path.resolve(projectPath, pkg.dir);
    if (seenPackageDirs.has(packageDir)) return;
    seenPackageDirs.add(packageDir);
    packages.push(pkg);
  };

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
      if (!entry.isDirectory) continue;
      const childDir = path.join(root.dir, entry.name);
      if (!(await isRealpathContained(path.join(projectPath, childDir), normalizedProject))) {
        continue;
      }
      addPackage(await readWorkspacePackage(projectPath, childDir, root.kind, normalizedProject));
    }
  }

  return packages;
}

export function formatWorkspaceGraph(packages: WorkspacePackage[]): string {
  if (packages.length === 0) {
    return "No workspace packages detected.";
  }

  const nameToPkg = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const edges = packages.map((pkg) => ({
    from: pkg.name,
    to: pkg.dependencies.filter((dep) => nameToPkg.has(dep)),
  }));

  const lines: string[] = [];
  lines.push(`Workspace packages: ${packages.length}`);
  lines.push("");
  lines.push("Packages:");
  for (const pkg of packages) {
    lines.push(`- ${pkg.name} (${pkg.kind}, ${pkg.dir})`);
  }

  lines.push("");
  lines.push("Dependency graph (internal only):");
  for (const edge of edges) {
    if (edge.to.length === 0) {
      lines.push(`- ${edge.from} -> (none)`);
    } else {
      lines.push(`- ${edge.from} -> ${edge.to.join(", ")}`);
    }
  }

  return lines.join("\n");
}
