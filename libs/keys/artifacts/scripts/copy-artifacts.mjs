import { resolve } from "node:path";
import { copyArtifactsToPackage } from "@diffgazer/registry";

const PKG_DIR = resolve(import.meta.dirname, "..");
const KEYS_ROOT = resolve(PKG_DIR, "..");

copyArtifactsToPackage({
  sourceRoot: KEYS_ROOT,
  packageRoot: PKG_DIR,
  label: "keys-artifacts",
  rebuildHint: "pnpm --filter @diffgazer/keys build:artifacts",
});
