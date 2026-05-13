import { relative, resolve } from "node:path";
import { collectFiles } from "./files.mjs";
import { toPosixPath } from "./paths.mjs";

export function validateArtifactPackSurface(root, library, packedFiles) {
  const packageRoot = resolve(root, library.workspaceDir);
  const artifactRoot = resolve(packageRoot, "dist/artifacts");
  const required = collectFiles(artifactRoot).map((file) => toPosixPath(relative(packageRoot, file)));
  const missing = required.filter((path) => !packedFiles.includes(path));

  return missing.length
    ? [`${library.packageName} npm pack is missing docs artifacts: ${missing.join(", ")}`]
    : [];
}
