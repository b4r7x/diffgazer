import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { runArgv } from "./smoke-shared/command.mjs";
import {
  packageNameFromSpec,
  packWorkspacePackage,
  pnpmAddFlags,
  resolveAndCollectMissing,
  skipMissingSmokeDeps,
} from "./smoke-shared/dependencies.mjs";
import { networkAllowed } from "./smoke-shared/network.mjs";

const packageDirs = {
  "@diffgazer/ui": "libs/ui",
  "@diffgazer/keys": "libs/keys",
  "@diffgazer/add": "cli/add",
  "@diffgazer/web": "apps/web",
  diffgazer: "cli/diffgazer",
};

function readPackageJson(root, workspacePackage) {
  const packageDir = packageDirs[workspacePackage];
  if (!packageDir) {
    throw new Error(`No smoke package directory configured for ${workspacePackage}`);
  }
  return JSON.parse(readFileSync(resolve(root, packageDir, "package.json"), "utf-8"));
}

function resolveInstalledDependency(
  root,
  workspacePackage,
  packageName,
  sourcePackages = [workspacePackage],
) {
  for (const sourcePackage of sourcePackages) {
    const packageDir = packageDirs[sourcePackage];
    if (!packageDir) {
      throw new Error(`No smoke package directory configured for ${sourcePackage}`);
    }

    const packagePath = resolve(root, packageDir, "node_modules", ...packageName.split("/"));
    if (existsSync(packagePath)) return realpathSync(packagePath);
  }

  const rootPath = resolve(root, "node_modules", ...packageName.split("/"));
  if (existsSync(rootPath)) return realpathSync(rootPath);

  throw new Error(`Cannot resolve local dependency ${packageName} for ${workspacePackage}`);
}

export function localDependencySpecs(root, workspacePackage, smoke) {
  const workspacePackages = [workspacePackage, ...(smoke.workspaceDeps ?? [])];
  const dependencySourcePackages = [
    workspacePackage,
    ...(smoke.workspaceDeps ?? []),
    ...(smoke.dependencySourcePackages ?? []),
  ];
  const specs = new Map();

  for (const packageName of workspacePackages) {
    const pkg = readPackageJson(root, packageName);
    const runtimeDependencies = {
      ...pkg.dependencies,
      ...pkg.optionalDependencies,
    };
    for (const depName of Object.keys(runtimeDependencies)) {
      if (!depName.startsWith("@diffgazer/")) {
        specs.set(depName, `link:${resolveInstalledDependency(root, packageName, depName)}`);
      }
    }
  }

  for (const depSpec of smoke.installDeps ?? []) {
    const depName = packageNameFromSpec(depSpec);
    if (depName && !depName.startsWith("@diffgazer/")) {
      specs.set(
        depName,
        `link:${resolveInstalledDependency(root, workspacePackage, depName, dependencySourcePackages)}`,
      );
    }
  }

  return new Map([...specs.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function writeOfflineOverrides(root, projectDir, workspacePackage, smoke) {
  const specs = localDependencySpecs(root, workspacePackage, smoke);
  if (specs.size === 0) return specs;

  writeFileSync(
    resolve(projectDir, "pnpm-workspace.yaml"),
    stringifyYaml({ packages: [], overrides: Object.fromEntries(specs) }),
  );
  return specs;
}

function missingLocalInstallDeps(root, workspacePackage, smoke) {
  const dependencySourcePackages = [
    workspacePackage,
    ...(smoke.workspaceDeps ?? []),
    ...(smoke.dependencySourcePackages ?? []),
  ];

  const depNames = (smoke.installDeps ?? [])
    .map((depSpec) => packageNameFromSpec(depSpec))
    .filter((depName) => depName && !depName.startsWith("@diffgazer/"));

  const missing = resolveAndCollectMissing(depNames, (depName) =>
    resolveInstalledDependency(root, workspacePackage, depName, dependencySourcePackages),
  );

  return [...new Set(missing)];
}

export function shouldRunPackageSmoke(root, item) {
  if (networkAllowed() || !item.optionalWhenDepsMissing) return true;

  const missing = missingLocalInstallDeps(root, item.name, item);
  if (missing.length === 0) return true;

  return !skipMissingSmokeDeps(item.label ?? item.name, missing);
}

export function createPackageTarballCache(root, options = {}) {
  const pack = options.pack ?? packWorkspacePackage;
  const packDir = options.packDir ?? realpathSync(mkdtempSync(resolve(tmpdir(), "dg-packs-")));
  const cleanup = options.cleanup ?? (() => rmSync(packDir, { recursive: true, force: true }));
  const tarballs = new Map();
  let disposed = false;

  return {
    async get(workspacePackage) {
      if (disposed) throw new Error("Package tarball cache is already disposed");
      const cached = tarballs.get(workspacePackage);
      if (cached) return cached;

      const pending = Promise.resolve(pack(root, workspacePackage, packDir)).catch((error) => {
        tarballs.delete(workspacePackage);
        throw error;
      });
      tarballs.set(workspacePackage, pending);
      return pending;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cleanup();
    },
  };
}

let runnerTarballCache;

function getRunnerTarballCache(root) {
  if (!runnerTarballCache) runnerTarballCache = createPackageTarballCache(root);
  return runnerTarballCache;
}

process.once("exit", () => runnerTarballCache?.dispose());

// List the file paths inside a packed .tgz (stripping the leading "package/"
// prefix npm adds) so a smoke can assert the tarball actually ships what its
// build is supposed to produce.
async function listTarballFiles(tgzPath) {
  const output = await runArgv("tar", ["-tzf", tgzPath]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^package\//, ""));
}

async function runSmokeStep(step, projectDir) {
  if (!step || typeof step !== "object" || typeof step.command !== "string") {
    throw new Error("Package smoke steps must be objects with a command string");
  }

  const args = step.args ?? [];
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error(`Package smoke step ${step.command} must provide string args`);
  }

  return (await runArgv(step.command, args, { cwd: projectDir })).trim();
}

async function runSmokeSteps(smoke, projectDir) {
  if (!Array.isArray(smoke.steps) || smoke.steps.length === 0) {
    throw new Error(`Package smoke ${smoke.label ?? smoke.name} must define at least one step`);
  }

  const output = [];
  for (const step of smoke.steps) {
    const result = await runSmokeStep(step, projectDir);
    if (result) output.push(result);
  }
  return output.join("\n");
}

function makeTempPackageProject() {
  return realpathSync(mkdtempSync(resolve(tmpdir(), "dg-smoke-")));
}

export async function withTempPackageProject(root, workspacePackage, smoke) {
  const projectDir = makeTempPackageProject();
  const tgzPaths = [];
  await runArgv("npm", ["-v"], { cwd: root });

  try {
    await runArgv("npm", ["init", "-y"], { cwd: projectDir });
    await runArgv("npm", ["pkg", "set", "type=module"], { cwd: projectDir });
    const packageManager = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf-8"),
    ).packageManager;
    await runArgv("npm", ["pkg", "set", `packageManager=${packageManager}`], {
      cwd: projectDir,
    });

    const tarballCache = getRunnerTarballCache(root);
    const mainTgz = await tarballCache.get(workspacePackage);
    tgzPaths.push(mainTgz);
    if (smoke.assertTarball) smoke.assertTarball(await listTarballFiles(mainTgz));
    for (const dep of smoke.workspaceDeps ?? []) {
      tgzPaths.push(await tarballCache.get(dep));
    }
    const installDeps = networkAllowed()
      ? (smoke.installDeps ?? [])
      : [...writeOfflineOverrides(root, projectDir, workspacePackage, smoke).values()];
    // Missing-peer and runtime-only fixtures disable pnpm peer auto-install so
    // the temporary project contains exactly the host dependencies they list.
    // Their runtime steps then verify the expected missing-peer or optional-peer
    // contract against the packed package.
    const peerFlags = smoke.skipPeerAutoInstall
      ? ["--config.auto-install-peers=false", "--config.strict-peer-dependencies=false"]
      : [];
    await runArgv("pnpm", ["add", ...pnpmAddFlags(), ...peerFlags, ...tgzPaths, ...installDeps], {
      cwd: projectDir,
      timeoutMs: 900_000,
    });
    smoke.prepare?.(projectDir);
    const result = await runSmokeSteps(smoke, projectDir);
    const verification = smoke.verify?.(projectDir);
    return [result, verification].filter(Boolean).join("\n").trim();
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
}
