import { resolve } from "node:path";
import { copyArtifactsToPackage } from "@diffgazer/registry";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");

copyArtifactsToPackage({
  sourceRoot: REPO_ROOT,
  packageRoot: PACKAGE_ROOT,
  label: "diffgazer-add",
  rebuildHint: "pnpm --dir ../.. build:artifacts",
  cleanStrategy: "artifact-dir",
});
