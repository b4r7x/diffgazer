import { execFile } from "node:child_process";
import * as clack from "@clack/prompts";
import type { PackageManager } from "./detect.js";
import { readPackageJson } from "./detect.js";
import { error, isSilentMode } from "./terminal.js";

const VALID_PKG_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;
const VERSION_SPEC_PATTERN = /^[a-zA-Z0-9._\-~/^*@:+]+$/;

const REJECTED_PROTOCOLS = ["file:", "git+", "git:", "https:", "http:", "link:", "npm:"];

export function depName(dep: string): string {
  if (!dep.includes("@")) return dep;
  const searchFrom = dep.startsWith("@") ? dep.indexOf("/") + 1 : 0;
  const versionAt = dep.indexOf("@", searchFrom);
  return versionAt > 0 ? dep.slice(0, versionAt) : dep;
}

export function normalizeVersionSpec(raw: unknown, packageName = "package"): string {
  const spec = String(raw ?? "latest").trim();
  if (spec.length === 0) {
    throw new Error(`${packageName} version cannot be empty.`);
  }
  if (spec.startsWith("-")) {
    throw new Error(`Invalid ${packageName} version "${spec}".`);
  }
  if (!VERSION_SPEC_PATTERN.test(spec)) {
    throw new Error(
      `Invalid ${packageName} version "${spec}". Use a semver, range, or dist tag (for example: latest, 0.1.1, ^0.1.0).`,
    );
  }
  const lower = spec.toLowerCase();
  for (const protocol of REJECTED_PROTOCOLS) {
    if (lower.startsWith(protocol)) {
      throw new Error(
        `Invalid ${packageName} version "${spec}". Protocol or alias sources are not allowed.`,
      );
    }
  }
  return spec;
}

/** Reject dependency strings that use protocols, absolute paths, or path traversal. */
export function validateDependencyProtocol(dep: string): void {
  const lower = dep.toLowerCase();
  for (const protocol of REJECTED_PROTOCOLS) {
    if (lower.startsWith(protocol)) {
      throw new Error(`Rejected dependency "${dep}": ${protocol} sources are not allowed.`);
    }
  }
  if (dep.startsWith("/") || dep.startsWith("\\")) {
    throw new Error(`Rejected dependency "${dep}": absolute paths are not allowed.`);
  }
  if (dep.includes("..")) {
    throw new Error(`Rejected dependency "${dep}": path traversal is not allowed.`);
  }
}

function validatePackageNames(deps: string[]): void {
  for (const dep of deps) {
    validateDependencyProtocol(dep);
    if (!VALID_PKG_NAME.test(depName(dep))) {
      throw new Error(`Invalid package name: "${dep}"`);
    }
  }
}

async function installDeps(pm: PackageManager, deps: string[], cwd: string): Promise<void> {
  if (deps.length === 0) return;
  validatePackageNames(deps);

  const args = pm === "npm" ? ["install", ...deps] : ["add", ...deps];
  return new Promise((res, reject) => {
    execFile(pm, args, { cwd, timeout: 120_000 }, (err, _stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim();
        if (msg) reject(new Error(`${pm} install failed:\n${msg}`));
        else reject(err);
        return;
      }
      res();
    });
  });
}

function logInstallError(e: unknown, pm: PackageManager, deps: string[]): void {
  if (!(e instanceof Error)) {
    error(`Try manually: ${pm} add ${deps.join(" ")}`);
    return;
  }
  const lines = e.message.split("\n").filter(Boolean);
  const maxLines = process.env.DEBUG ? lines.length : 3;
  for (const line of lines.slice(0, maxLines)) {
    error(line);
  }
  if (!process.env.DEBUG && lines.length > maxLines) {
    error(`  ... ${lines.length - maxLines} more lines (set DEBUG=1 for full output)`);
  }
  error(`Try manually: ${pm} add ${deps.join(" ")}`);
}

export async function installDepsWithSpinner(
  pm: PackageManager,
  deps: string[],
  cwd: string,
): Promise<boolean> {
  if (isSilentMode()) {
    try {
      await installDeps(pm, deps, cwd);
      return true;
    } catch {
      return false;
    }
  }

  const s = clack.spinner();
  s.start("Installing dependencies...");
  try {
    await installDeps(pm, deps, cwd);
    s.stop(`Installed ${deps.length} package(s)`);
    return true;
  } catch (e) {
    s.stop("Failed to install dependencies");
    logInstallError(e, pm, deps);
    return false;
  }
}

export function getInstalledDeps(cwd: string): Set<string> {
  const pkg = readPackageJson(cwd);
  if (!pkg) return new Set();
  return new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ]);
}
