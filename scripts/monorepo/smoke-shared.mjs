import { execSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

export function quoteArgs(args) {
  return args.map((arg) => JSON.stringify(arg)).join(" ");
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

export function networkAllowed() {
  return process.env.DIFFGAZER_SMOKE_ALLOW_NETWORK === "1";
}

export function pnpmAddFlags() {
  return networkAllowed()
    ? ["--fetch-retries=0"]
    : ["--offline", "--fetch-retries=0"];
}

export function resolveLocalDependency(root, packageName) {
  for (const dir of ["apps/web", "libs/ui", "libs/keys", "."]) {
    const depPath = resolve(root, dir, "node_modules", ...packageName.split("/"));
    if (existsSync(depPath)) return `link:${realpathSync(depPath)}`;
  }
  throw new Error(`Cannot resolve local dependency for smoke test: ${packageName}`);
}

export function run(cmd, cwdOrOptions) {
  const options = typeof cwdOrOptions === "string" ? { cwd: cwdOrOptions } : (cwdOrOptions ?? {});
  return execSync(cmd, {
    encoding: "utf8",
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : undefined,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  }).toString();
}
