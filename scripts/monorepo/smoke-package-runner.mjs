import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  networkAllowed,
  packageNameFromSpec,
  pnpmAddFlags,
  skipMissingSmokeDeps,
} from "./smoke-shared.mjs";

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

function resolveInstalledDependency(root, workspacePackage, packageName, sourcePackages = [workspacePackage]) {
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

function localDependencySpecs(root, workspacePackage, smoke) {
  const workspacePackages = [workspacePackage, ...(smoke.workspaceDeps ?? [])];
  const dependencySourcePackages = [
    workspacePackage,
    ...(smoke.workspaceDeps ?? []),
    ...(smoke.dependencySourcePackages ?? []),
  ];
  const specs = new Map();

  for (const packageName of workspacePackages) {
    const pkg = readPackageJson(root, packageName);
    for (const depName of Object.keys(pkg.dependencies ?? {})) {
      if (!depName.startsWith("@diffgazer/")) {
        specs.set(depName, `link:${resolveInstalledDependency(root, packageName, depName)}`);
      }
    }
  }

  for (const depSpec of smoke.installDeps ?? []) {
    const depName = packageNameFromSpec(depSpec);
    if (depName && !depName.startsWith("@diffgazer/")) {
      specs.set(depName, `link:${resolveInstalledDependency(root, workspacePackage, depName, dependencySourcePackages)}`);
    }
  }

  return new Map([...specs.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function writeOfflineOverrides(root, projectDir, workspacePackage, smoke) {
  const specs = localDependencySpecs(root, workspacePackage, smoke);
  if (specs.size === 0) return specs;

  const packageJsonPath = resolve(projectDir, "package.json");
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  pkg.pnpm = {
    ...(pkg.pnpm ?? {}),
    overrides: {
      ...(pkg.pnpm?.overrides ?? {}),
      ...Object.fromEntries(specs),
    },
  };
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return specs;
}

function missingLocalInstallDeps(root, workspacePackage, smoke) {
  const dependencySourcePackages = [
    workspacePackage,
    ...(smoke.workspaceDeps ?? []),
    ...(smoke.dependencySourcePackages ?? []),
  ];
  const missing = [];

  for (const depSpec of smoke.installDeps ?? []) {
    const depName = packageNameFromSpec(depSpec);
    if (!depName || depName.startsWith("@diffgazer/")) continue;

    try {
      resolveInstalledDependency(root, workspacePackage, depName, dependencySourcePackages);
    } catch {
      missing.push(depName);
    }
  }

  return [...new Set(missing)];
}

export function shouldRunPackageSmoke(root, item) {
  if (networkAllowed() || !item.optionalWhenDepsMissing) return true;

  const missing = missingLocalInstallDeps(root, item.name, item);
  if (missing.length === 0) return true;

  return !skipMissingSmokeDeps(item.label ?? item.name, missing);
}

function parsePackOutput(raw) {
  const starts = [...raw.matchAll(/[\[{]/g)].map((match) => match.index ?? 0);
  const ends = [...raw.matchAll(/[\]}]/g)].map((match) => match.index ?? 0).reverse();

  for (const start of starts) {
    for (const end of ends) {
      if (end <= start) continue;
      const candidate = raw.slice(start, end + 1);
      try {
        const parsed = JSON.parse(candidate);
        const packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
        if (packInfo?.filename) return parsed;
      } catch {
        // pnpm lifecycle logs can be mixed into stdout; keep scanning.
      }
    }
  }

  throw new Error(`Could not parse pnpm pack --json output:\n${raw.slice(0, 1000)}`);
}

function packWorkspacePackage(root, workspacePackage, packDir) {
  const packOutput = execFileSync("pnpm", [
    "--dir",
    root,
    "--filter",
    workspacePackage,
    "pack",
    "--pack-destination",
    packDir,
    "--json",
  ], {
    cwd: root,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  const parsedPack = parsePackOutput(packOutput);
  const packInfo = Array.isArray(parsedPack) ? parsedPack[0] : parsedPack;
  return resolve(packDir, packInfo.filename);
}

function execFile(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runSmokeStep(step, projectDir) {
  if (!step || typeof step !== "object" || typeof step.command !== "string") {
    throw new Error("Package smoke steps must be objects with a command string");
  }

  const args = step.args ?? [];
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error(`Package smoke step ${step.command} must provide string args`);
  }

  return execFile(step.command, args, { cwd: projectDir }).trim();
}

function runSmokeSteps(smoke, projectDir) {
  if (!Array.isArray(smoke.steps) || smoke.steps.length === 0) {
    throw new Error(`Package smoke ${smoke.label ?? smoke.name} must define at least one step`);
  }

  return smoke.steps
    .map((step) => runSmokeStep(step, projectDir))
    .filter(Boolean)
    .join("\n");
}

function makeTempPackageProject() {
  return realpathSync(mkdtempSync(resolve(tmpdir(), "dg-smoke-")));
}

export function withTempPackageProject(root, workspacePackage, smoke) {
  const projectDir = makeTempPackageProject();
  const packDir = resolve(projectDir, "packs");
  const tgzPaths = [];
  execFile("npm", ["-v"], { cwd: root });

  try {
    mkdirSync(packDir, { recursive: true });
    execFile("npm", ["init", "-y"], { cwd: projectDir });
    execFile("npm", ["pkg", "set", "type=module"], { cwd: projectDir });

    tgzPaths.push(packWorkspacePackage(root, workspacePackage, packDir));
    for (const dep of smoke.workspaceDeps ?? []) {
      tgzPaths.push(packWorkspacePackage(root, dep, packDir));
    }
    const installDeps = networkAllowed()
      ? (smoke.installDeps ?? [])
      : [...writeOfflineOverrides(root, projectDir, workspacePackage, smoke).values()];
    execFileSync("pnpm", ["add", ...pnpmAddFlags(), ...tgzPaths, ...installDeps], {
      cwd: projectDir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    smoke.prepare?.(projectDir);
    const result = runSmokeSteps(smoke, projectDir);
    const verification = smoke.verify?.(projectDir);
    return [result, verification].filter(Boolean).join("\n").trim();
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
}
