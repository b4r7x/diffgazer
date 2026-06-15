import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// Generates THIRD_PARTY_NOTICES for the diffgazer tarball. The Apache-2.0 binary
// bundles MIT-licensed first-party workspace packages (@diffgazer/keys directly
// via tsup noExternal, @diffgazer/ui through the embedded SPA) plus the SPA's
// third-party prod dependencies, whose @license banners the Vite build strips.
// MIT requires notice retention, so their license texts ship here.

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");
const OUTPUT_PATH = resolve(PACKAGE_ROOT, "THIRD_PARTY_NOTICES");

const LICENSE_FILENAMES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "license", "License"];

interface NoticeEntry {
  name: string;
  licenseText: string;
}

function readLicenseFile(packageDir: string, name: string): string {
  for (const filename of LICENSE_FILENAMES) {
    const licensePath = resolve(packageDir, filename);
    if (existsSync(licensePath)) {
      return readFileSync(licensePath, "utf-8").trimEnd();
    }
  }
  throw new Error(`No LICENSE file found for "${name}" in ${packageDir}`);
}

// First-party MIT workspace packages whose source is inlined into the published
// binary (directly or through the embedded SPA bundle).
function collectWorkspaceNotices(): NoticeEntry[] {
  const workspacePackages = [
    { name: "@diffgazer/keys", dir: resolve(WORKSPACE_ROOT, "libs/keys") },
    { name: "@diffgazer/ui", dir: resolve(WORKSPACE_ROOT, "libs/ui") },
  ];
  return workspacePackages.map(({ name, dir }) => ({
    name,
    licenseText: readLicenseFile(dir, name),
  }));
}

// Third-party prod dependencies the SPA bundles, derived from apps/web's
// dependencies (workspace packages are covered above).
function collectSpaThirdPartyNotices(): NoticeEntry[] {
  const webPackageJson = JSON.parse(
    readFileSync(resolve(WORKSPACE_ROOT, "apps/web/package.json"), "utf-8"),
  ) as { dependencies?: Record<string, string> };
  const dependencies = webPackageJson.dependencies ?? {};

  const require = createRequire(resolve(WORKSPACE_ROOT, "apps/web/package.json"));
  const notices: NoticeEntry[] = [];

  for (const name of Object.keys(dependencies).sort()) {
    if (name.startsWith("@diffgazer/")) continue;
    notices.push({ name, licenseText: readLicenseFile(resolvePackageDir(require, name), name) });
  }

  return notices;
}

// Resolve a package's root directory even when its `exports` map blocks
// `./package.json` (e.g. @tailwindcss/vite): fall back to resolving the package
// entry and walking up to the directory that owns its package.json.
function resolvePackageDir(require: NodeRequire, name: string): string {
  try {
    return dirname(require.resolve(`${name}/package.json`));
  } catch {
    let dir = dirname(require.resolve(name));
    while (!existsSync(resolve(dir, "package.json"))) {
      const parent = dirname(dir);
      if (parent === dir) throw new Error(`Could not locate package root for "${name}"`);
      dir = parent;
    }
    return dir;
  }
}

function renderNotices(entries: NoticeEntry[]): string {
  const header = [
    "THIRD PARTY NOTICES",
    "",
    "The diffgazer binary (Apache-2.0) bundles the first-party and third-party",
    "packages listed below. Their license texts are reproduced here to satisfy",
    "notice-retention requirements.",
    "",
  ].join("\n");

  const sections = entries.map((entry) =>
    ["-".repeat(72), entry.name, "-".repeat(72), "", entry.licenseText].join("\n"),
  );

  return `${[header, ...sections].join("\n\n")}\n`;
}

const entries = [...collectWorkspaceNotices(), ...collectSpaThirdPartyNotices()];
writeFileSync(OUTPUT_PATH, renderNotices(entries));
console.log(`Wrote ${OUTPUT_PATH} (${entries.length} packages)`);
