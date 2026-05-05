import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { resetDir } from "../utils/fs.js";

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

export function resolveLocalShadcnBin(rootDir: string): string | undefined {
  const candidates = [
    resolve(rootDir, "node_modules/.bin/shadcn"),
    resolve(rootDir, "../node_modules/.bin/shadcn"),
    resolve(rootDir, "../../node_modules/.bin/shadcn"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

export interface RunShadcnRegistryBuildOptions {
  rootDir: string;
  registryPath?: string;
  outputDir?: string;
}

export function runShadcnRegistryBuild(options: RunShadcnRegistryBuildOptions): void {
  const {
    rootDir,
    registryPath = "registry/registry.json",
    outputDir = "public/r",
  } = options;

  const localBin = resolveLocalShadcnBin(rootDir);
  if (!localBin) {
    throw new Error(
      "Local shadcn CLI binary not found.\nInstall dependencies so node_modules/.bin/shadcn exists.",
    );
  }

  resetDir(resolve(rootDir, outputDir));
  run(localBin, ["build", registryPath, "--output", outputDir], rootDir);

  copyFileSync(resolve(rootDir, registryPath), resolve(rootDir, outputDir, "registry.json"));
}
