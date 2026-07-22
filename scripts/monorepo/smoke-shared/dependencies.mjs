import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { ENV } from "../lib/env.mjs";
import { runArgv } from "./command.mjs";
import { networkAllowed } from "./network.mjs";

export function resolveAndCollectMissing(deps, resolveFn) {
  const missing = [];
  for (const dep of deps) {
    try {
      resolveFn(dep);
    } catch {
      missing.push(dep);
    }
  }
  return missing;
}

export function packageNameFromSpec(spec) {
  if (spec.startsWith("/") || spec.startsWith(".")) return null;
  if (spec.startsWith("@")) {
    const [scope, rest = ""] = spec.split("/");
    const name = rest.split("@")[0];
    return name ? `${scope}/${name}` : null;
  }
  return spec.split("@")[0] || null;
}

export function pnpmAddFlags() {
  return networkAllowed() ? ["--fetch-retries=0"] : ["--offline", "--fetch-retries=0"];
}

export function resolveLocalDependency(root, packageName) {
  for (const dir of ["apps/web", "libs/ui", "libs/keys", "."]) {
    const depPath = resolve(root, dir, "node_modules", ...packageName.split("/"));
    if (existsSync(depPath)) return `link:${realpathSync(depPath)}`;
  }
  throw new Error(`Cannot resolve local dependency for smoke test: ${packageName}`);
}

export const TAILWIND_V4_SPEC = "^4.0.0";

export function declareTailwindV4Dependency(fixture) {
  const packageJsonPath = resolve(fixture, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  if (packageJson.dependencies) {
    delete packageJson.dependencies.tailwindcss;
    if (Object.keys(packageJson.dependencies).length === 0) delete packageJson.dependencies;
  }
  packageJson.devDependencies = {
    ...(packageJson.devDependencies ?? {}),
    tailwindcss: TAILWIND_V4_SPEC,
  };
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function viteFixtureDependencySpecs(root) {
  return [
    "react",
    "react-dom",
    "@types/react",
    "@types/react-dom",
    "@types/node",
    "typescript",
    "vite",
    "@vitejs/plugin-react",
    "tailwindcss",
    "@tailwindcss/vite",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
  ].map((packageName) => resolveLocalDependency(root, packageName));
}

export async function installViteFixtureDeps(root, fixture) {
  await runArgv(
    "pnpm",
    ["add", "--offline", "--fetch-retries=0", ...viteFixtureDependencySpecs(root)],
    fixture,
  );
  declareTailwindV4Dependency(fixture);
}

export function skipMissingSmokeDeps(label, missing) {
  if (missing.length === 0) return false;

  if (process.env[ENV.smokeStrictSkips] === "1") {
    throw new Error(
      `Required smoke dependencies missing for ${label}: ${missing.join(", ")}. ` +
        `Install them locally or set ${ENV.smokeAllowNetwork}=1.`,
    );
  }

  console.log(
    `SKIP: ${label} (missing local dependencies: ${missing.join(", ")}; ` +
      `set ${ENV.smokeAllowNetwork}=1 to install them, or ${ENV.smokeStrictSkips}=1 to fail on skips)`,
  );
  return true;
}

function parsePackOutput(raw) {
  const starts = [...raw.matchAll(/[[{]/g)].map((match) => match.index ?? 0);
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

// pnpm pack --json reports `filename` as an absolute path or a bare filename depending on
// version/destination; resolve both forms against packDir.
export async function packWorkspacePackage(root, workspacePackage, packDir) {
  const packOutput = (
    await runArgv(
      "pnpm",
      [
        "--dir",
        root,
        "--filter",
        workspacePackage,
        "pack",
        "--pack-destination",
        packDir,
        "--json",
      ],
      {
        cwd: root,
        timeoutMs: 900_000,
      },
    )
  ).trim();

  const parsedPack = parsePackOutput(packOutput);
  const packInfo = Array.isArray(parsedPack) ? parsedPack[0] : parsedPack;
  return isAbsolute(packInfo.filename)
    ? packInfo.filename
    : join(packDir, basename(packInfo.filename));
}
