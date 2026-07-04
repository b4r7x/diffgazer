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

interface PackageJson {
  dependencies?: Record<string, string>;
  license?: string;
  optionalDependencies?: Record<string, string>;
}

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf-8")) as PackageJson;
}

function normalizeLicenseText(text: string): string {
  return text.replace(/[ \t]+$/gm, "").trimEnd();
}

function readLicenseText(packageDir: string, name: string): string {
  for (const filename of LICENSE_FILENAMES) {
    const licensePath = resolve(packageDir, filename);
    if (existsSync(licensePath)) {
      return normalizeLicenseText(readFileSync(licensePath, "utf-8"));
    }
  }

  const packageJson = readPackageJson(resolve(packageDir, "package.json"));
  if (packageJson.license === "Apache-2.0") {
    return normalizeLicenseText(readFileSync(resolve(PACKAGE_ROOT, "LICENSE"), "utf-8"));
  }
  if (packageJson.license === "MIT") {
    return normalizeLicenseText(
      readFileSync(resolve(WORKSPACE_ROOT, "libs/keys/LICENSE"), "utf-8"),
    );
  }

  throw new Error(`No LICENSE text found for "${name}" in ${packageDir}`);
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
    licenseText: readLicenseText(dir, name),
  }));
}

// Third-party prod dependencies the SPA bundles, derived from apps/web's
// dependencies (workspace packages are covered above).
function collectSpaThirdPartyNotices(): NoticeEntry[] {
  const webPackageJson = readPackageJson(resolve(WORKSPACE_ROOT, "apps/web/package.json"));
  const dependencies = webPackageJson.dependencies ?? {};

  const require = createRequire(resolve(WORKSPACE_ROOT, "apps/web/package.json"));
  const notices: NoticeEntry[] = [];

  for (const name of Object.keys(dependencies).sort()) {
    if (name.startsWith("@diffgazer/")) continue;
    notices.push({ name, licenseText: readLicenseText(resolvePackageDir(require, name), name) });
  }

  return notices;
}

function collectBundledServerThirdPartyNotices(): NoticeEntry[] {
  const serverPackageJsonPath = resolve(WORKSPACE_ROOT, "cli/server/package.json");
  const serverPackageJson = readPackageJson(serverPackageJsonPath);
  const cliPackageJson = readPackageJson(resolve(PACKAGE_ROOT, "package.json"));
  const serverRequire = createRequire(serverPackageJsonPath);
  const externalPackageNames = new Set([
    ...Object.keys(cliPackageJson.dependencies ?? {}),
    ...Object.keys(cliPackageJson.optionalDependencies ?? {}),
  ]);
  const visitedPackageNames = new Set<string>();
  const notices: NoticeEntry[] = [];

  function visitPackage(name: string, requireFromParent: NodeRequire): void {
    if (
      name.startsWith("@diffgazer/") ||
      externalPackageNames.has(name) ||
      visitedPackageNames.has(name)
    ) {
      return;
    }

    visitedPackageNames.add(name);
    const packageDir = resolvePackageDir(requireFromParent, name);
    notices.push({ name, licenseText: readLicenseText(packageDir, name) });

    const packageJsonPath = resolve(packageDir, "package.json");
    const packageJson = readPackageJson(packageJsonPath);
    const packageRequire = createRequire(packageJsonPath);
    for (const dependencyName of Object.keys(packageJson.dependencies ?? {}).sort()) {
      visitPackage(dependencyName, packageRequire);
    }
  }

  for (const name of Object.keys(serverPackageJson.dependencies ?? {}).sort()) {
    visitPackage(name, serverRequire);
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

const entries = [
  ...collectWorkspaceNotices(),
  ...collectSpaThirdPartyNotices(),
  ...collectBundledServerThirdPartyNotices(),
];
writeFileSync(OUTPUT_PATH, renderNotices(entries));
console.log(`Wrote ${OUTPUT_PATH} (${entries.length} packages)`);
