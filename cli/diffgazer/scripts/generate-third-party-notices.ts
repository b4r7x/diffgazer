import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");
const WEB_ROOT = resolve(WORKSPACE_ROOT, "apps/web");
const OUTPUT_PATH = resolve(PACKAGE_ROOT, "THIRD_PARTY_NOTICES");
const TSUP_METAFILE_PATH = resolve(PACKAGE_ROOT, "dist/metafile-esm.json");

const LICENSE_FILENAMES = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "LICENCE",
  "COPYING",
  "COPYING.md",
  "COPYING.txt",
  "license",
  "License",
];

interface PackageJson {
  license?: string;
  name?: string;
  version?: string;
}

export interface BundlePackage {
  license: string | null;
  licenseText: string | null;
  name: string;
  packageDir: string;
  version: string | null;
}

export interface GenerateNoticesResult {
  packageCount: number;
  text: string;
}

interface GenerateNoticesOptions {
  outputPath?: string;
  removeTsupMetafile?: boolean;
  tsupMetafilePath?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isViteModule(
  value: unknown,
): value is { build: (config: Record<string, unknown>) => Promise<unknown> } {
  return isRecord(value) && typeof value.build === "function";
}

function readPackageJson(path: string): PackageJson {
  const value: unknown = JSON.parse(readFileSync(path, "utf-8"));
  if (!isRecord(value)) throw new Error(`Invalid package manifest at ${path}`);

  return {
    license: typeof value.license === "string" ? value.license : undefined,
    name: typeof value.name === "string" ? value.name : undefined,
    version: typeof value.version === "string" ? value.version : undefined,
  };
}

export function normalizeLicenseText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trimEnd();
}

function readLicenseText(packageDir: string, packageJson: PackageJson): string | null {
  for (const filename of LICENSE_FILENAMES) {
    const licensePath = resolve(packageDir, filename);
    if (existsSync(licensePath)) {
      return normalizeLicenseText(readFileSync(licensePath, "utf-8"));
    }
  }

  if (packageJson.name?.startsWith("@diffgazer/") && packageJson.license === "MIT") {
    return normalizeLicenseText(
      readFileSync(resolve(WORKSPACE_ROOT, "libs/keys/LICENSE"), "utf-8"),
    );
  }
  if (packageJson.name === "@hono/zod-validator" && packageJson.license === "MIT") {
    // Its published tarball declares MIT but omits LICENSE; the Hono distribution's
    // MIT notice supplies the same project/author attribution instead of inventing one.
    const requireFromPackage = createRequire(resolve(PACKAGE_ROOT, "package.json"));
    const honoServerRoot = resolveModulePackageDir(requireFromPackage.resolve("@hono/node-server"));
    if (!honoServerRoot) throw new Error("Could not resolve the Hono MIT license fallback");
    return normalizeLicenseText(readFileSync(resolve(honoServerRoot, "LICENSE"), "utf-8"));
  }
  if (packageJson.license === "Apache-2.0") {
    return normalizeLicenseText(readFileSync(resolve(PACKAGE_ROOT, "LICENSE"), "utf-8"));
  }
  return null;
}

export function resolveModulePackageDir(modulePath: string): string | null {
  const cleanPath = modulePath.replace(/^\0+/, "").split("?", 1)[0];
  if (!cleanPath || !existsSync(cleanPath)) return null;

  let directory = dirname(cleanPath);
  while (true) {
    const packageJsonPath = resolve(directory, "package.json");
    if (existsSync(packageJsonPath) && readPackageJson(packageJsonPath).name) return directory;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function isNodeModulesPath(modulePath: string): boolean {
  const normalizedPath = modulePath.replace(/^\0+/, "").split("?", 1)[0]?.replaceAll("\\", "/");
  return (
    normalizedPath === "node_modules" ||
    normalizedPath?.startsWith("node_modules/") === true ||
    normalizedPath?.includes("/node_modules/") === true
  );
}

export function collectBundlePackages(modulePaths: readonly string[]): BundlePackage[] {
  const packageDirs = new Set<string>();
  for (const modulePath of modulePaths) {
    const packageDir = resolveModulePackageDir(modulePath);
    if (packageDir) {
      packageDirs.add(packageDir);
      continue;
    }
    if (isNodeModulesPath(modulePath)) {
      throw new Error(`Could not resolve package provenance for bundled module ${modulePath}`);
    }
  }

  const packages: BundlePackage[] = [];
  for (const packageDir of packageDirs) {
    const packageJson = readPackageJson(resolve(packageDir, "package.json"));
    if (!packageJson.name) {
      if (isNodeModulesPath(packageDir)) {
        throw new Error(`Bundled package manifest has no name at ${packageDir}`);
      }
      continue;
    }
    packages.push({
      license: packageJson.license ?? null,
      licenseText: readLicenseText(packageDir, packageJson),
      name: packageJson.name,
      packageDir,
      version: packageJson.version ?? null,
    });
  }

  return packages.sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name);
    if (nameOrder !== 0) return nameOrder;
    return (left.version ?? "").localeCompare(right.version ?? "");
  });
}

function requiresNotice(bundlePackage: BundlePackage): boolean {
  if (bundlePackage.name === "diffgazer" || bundlePackage.name === "@diffgazer/web") return false;
  if (bundlePackage.name.startsWith("@diffgazer/") && bundlePackage.license !== "MIT") {
    return false;
  }
  return true;
}

function packageLabel(bundlePackage: BundlePackage): string {
  return bundlePackage.version
    ? `${bundlePackage.name}@${bundlePackage.version}`
    : bundlePackage.name;
}

export function renderNotices(bundlePackages: readonly BundlePackage[]): string {
  const groups = new Map<string, Set<string>>();
  for (const bundlePackage of bundlePackages) {
    if (!requiresNotice(bundlePackage)) continue;
    if (!bundlePackage.licenseText) {
      throw new Error(
        `No license text found for bundled package ${packageLabel(bundlePackage)} in ${bundlePackage.packageDir}`,
      );
    }
    const labels = groups.get(bundlePackage.licenseText) ?? new Set<string>();
    labels.add(packageLabel(bundlePackage));
    groups.set(bundlePackage.licenseText, labels);
  }

  const header = [
    "THIRD PARTY NOTICES",
    "",
    "The diffgazer binary (Apache-2.0) bundles the packages listed below.",
    "Each package remains associated with its license notice; identical normalized",
    "license texts are reproduced once with all package provenance retained.",
    "",
  ].join("\n");
  const sections = [...groups.entries()]
    .map(([licenseText, labels]) => ({ labels: [...labels].sort(), licenseText }))
    .sort((left, right) => left.labels[0]?.localeCompare(right.labels[0] ?? "") ?? 0)
    .map(({ labels, licenseText }) =>
      [
        "-".repeat(72),
        "Packages:",
        ...labels.map((label) => `  - ${label}`),
        "-".repeat(72),
        "",
        licenseText,
      ].join("\n"),
    );

  return `${[header, ...sections].join("\n\n")}\n`;
}

function collectRollupModuleIds(result: unknown): string[] {
  const outputs = Array.isArray(result) ? result : [result];
  const moduleIds = new Set<string>();

  for (const output of outputs) {
    if (!isRecord(output) || !Array.isArray(output.output)) continue;
    for (const item of output.output) {
      if (!isRecord(item) || item.type !== "chunk" || !isRecord(item.modules)) continue;
      for (const moduleId of Object.keys(item.modules)) moduleIds.add(moduleId);
    }
  }

  if (moduleIds.size === 0) throw new Error("Vite returned no Rollup chunk modules");
  return [...moduleIds].sort();
}

export async function collectViteBundleModuleIds(): Promise<string[]> {
  const requireFromWeb = createRequire(resolve(WEB_ROOT, "package.json"));
  const viteUrl = pathToFileURL(requireFromWeb.resolve("vite")).href;
  const viteModule: unknown = await import(viteUrl);
  if (!isViteModule(viteModule)) throw new Error(`Invalid Vite module resolved from ${viteUrl}`);

  const result = await viteModule.build({
    root: WEB_ROOT,
    configFile: resolve(WEB_ROOT, "vite.config.ts"),
    build: { write: false },
    logLevel: "silent",
  });
  return collectRollupModuleIds(result);
}

export function collectTsupBundleModuleIds(metafilePath = TSUP_METAFILE_PATH): string[] {
  const value: unknown = JSON.parse(readFileSync(metafilePath, "utf-8"));
  if (!isRecord(value) || !isRecord(value.inputs)) {
    throw new Error(`Invalid tsup metafile at ${metafilePath}`);
  }

  return Object.keys(value.inputs)
    .map((input) => (isAbsolute(input) ? input : resolve(PACKAGE_ROOT, input)))
    .sort();
}

export async function generateThirdPartyNotices({
  outputPath = OUTPUT_PATH,
  removeTsupMetafile = false,
  tsupMetafilePath = TSUP_METAFILE_PATH,
}: GenerateNoticesOptions = {}): Promise<GenerateNoticesResult> {
  const viteModuleIds = await collectViteBundleModuleIds();
  const tsupModuleIds = collectTsupBundleModuleIds(tsupMetafilePath);
  const bundlePackages = collectBundlePackages([...viteModuleIds, ...tsupModuleIds]);
  const text = renderNotices(bundlePackages);
  writeFileSync(outputPath, text);
  if (removeTsupMetafile) rmSync(tsupMetafilePath, { force: true });
  return { packageCount: bundlePackages.filter(requiresNotice).length, text };
}

async function main(): Promise<void> {
  const result = await generateThirdPartyNotices({ removeTsupMetafile: true });
  console.log(`Wrote ${OUTPUT_PATH} (${result.packageCount} packages)`);
}

const entryPath = process.argv[1];
if (entryPath && resolve(entryPath) === fileURLToPath(import.meta.url)) {
  await main();
}
