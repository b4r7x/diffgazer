import type { WorkspacePackage } from "./discovery.js";

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
