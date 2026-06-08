import { access, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

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
    console.warn(
      `[context] Ignoring unreadable package manifest at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }

  const result = PackageManifestSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[context] Ignoring invalid package manifest at ${filePath}: ${formatSchemaIssues(result.error)}`,
    );
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

async function filterEscapedRoots(
  roots: WorkspaceRoot[],
  projectPath: string,
): Promise<WorkspaceRoot[]> {
  const normalizedProject = await realpath(projectPath).catch(() => path.resolve(projectPath));
  const results: WorkspaceRoot[] = [];
  for (const root of roots) {
    const resolved = path.resolve(normalizedProject, root.dir);
    const real = await realpath(resolved).catch(() => resolved);
    if (real === normalizedProject || real.startsWith(normalizedProject + path.sep)) {
      results.push(root);
    }
  }
  return results;
}

async function getWorkspaceRoots(projectPath: string): Promise<WorkspaceRoot[]> {
  const yamlPath = path.join(projectPath, "pnpm-workspace.yaml");
  try {
    const content = await readFile(yamlPath, "utf8");
    const globs = parseWorkspaceYaml(content);
    if (globs.length > 0) {
      return await filterEscapedRoots(resolveWorkspaceRoots(globs), projectPath);
    }
  } catch {
    // pnpm-workspace.yaml not found — fall through to defaults
  }
  return FALLBACK_WORKSPACE_ROOTS;
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
): Promise<WorkspacePackage | null> {
  const pkgJson = await readPackageManifest(path.join(projectPath, dir, "package.json"));
  if (!pkgJson?.name) return null;

  return {
    name: pkgJson.name,
    dir,
    kind,
    dependencies: collectDependencies(pkgJson),
  };
}

export async function discoverWorkspacePackages(projectPath: string): Promise<WorkspacePackage[]> {
  const roots = await getWorkspaceRoots(projectPath);

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
      addPackage(await readWorkspacePackage(projectPath, root.dir, root.kind));
    }
    if (!root.includeChildren) continue;

    const entries = await readFileDirectory(absoluteRoot);
    for (const entry of entries) {
      if (!entry.isDirectory) continue;
      addPackage(
        await readWorkspacePackage(projectPath, path.join(root.dir, entry.name), root.kind),
      );
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
