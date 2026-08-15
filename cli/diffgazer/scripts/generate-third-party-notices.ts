import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");
const WEB_ROOT = resolve(WORKSPACE_ROOT, "apps/web");
const OUTPUT_PATH = resolve(PACKAGE_ROOT, "THIRD_PARTY_NOTICES");
const TSUP_METAFILE_PATH = resolve(PACKAGE_ROOT, "dist/metafile-esm.json");

const WEB_FONT_LICENSE_PATH = resolve(WEB_ROOT, "src/assets/fonts/LICENSE");

const VITE_VIRTUAL_MODULE_OWNERS: Record<string, string> = {
  "commonjsHelpers.js": "vite",
  "vite/modulepreload-polyfill.js": "vite",
  "vite/preload-helper.js": "vite",
};

const EMBEDDED_ASSET_PROVENANCE = [
  {
    assetPattern: /jetbrains-mono.*\.woff2$/,
    labels: ["JetBrains Mono (apps/web/src/assets/fonts/jetbrains-mono.woff2)"],
    licensePath: WEB_FONT_LICENSE_PATH,
  },
] as const;

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

export interface EmbeddedProvenance {
  labels: string[];
  licenseText: string;
}

export interface ViteBundleGraph {
  assetFileNames: string[];
  moduleIds: string[];
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
  // No blanket per-license fallback: diffgazer's own LICENSE carries its own copyright
  // line, so substituting it would misattribute a third party. A dependency shipping no
  // license text must get an explicit, justified fallback like the one above.
  return null;
}

function stripModuleQuery(modulePath: string): string {
  return modulePath.replace(/^\0+/, "").replace(/\?.*$/s, "");
}

function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}

/**
 * The installed package directory that owns a `node_modules` module, so provenance
 * resolution can fail closed instead of climbing into an enclosing workspace manifest.
 */
function nodeModulesPackageRoot(cleanPath: string): string | null {
  const normalizedPath = toPosixPath(cleanPath);
  const marker = normalizedPath.lastIndexOf("/node_modules/");
  if (marker === -1) return null;

  const prefix = normalizedPath.slice(0, marker + "/node_modules/".length);
  const [scopeOrName, scopedName] = normalizedPath.slice(prefix.length).split("/");
  if (!scopeOrName) return null;
  if (!scopeOrName.startsWith("@")) return `${prefix}${scopeOrName}`;
  return scopedName ? `${prefix}${scopeOrName}/${scopedName}` : null;
}

export function resolveModulePackageDir(modulePath: string): string | null {
  const cleanPath = stripModuleQuery(modulePath);
  if (!cleanPath || !existsSync(cleanPath)) return null;

  const packageRoot = nodeModulesPackageRoot(cleanPath);
  let directory = dirname(cleanPath);
  while (true) {
    const packageJsonPath = resolve(directory, "package.json");
    if (existsSync(packageJsonPath) && readPackageJson(packageJsonPath).name) return directory;
    if (packageRoot !== null && toPosixPath(directory) === packageRoot) return null;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function isNodeModulesPath(modulePath: string): boolean {
  const normalizedPath = toPosixPath(stripModuleQuery(modulePath));
  return (
    normalizedPath === "node_modules" ||
    normalizedPath.startsWith("node_modules/") ||
    normalizedPath.includes("/node_modules/")
  );
}

function resolveVirtualModulePackageDir(modulePath: string): string | null {
  const ownerPackage = VITE_VIRTUAL_MODULE_OWNERS[stripModuleQuery(modulePath)];
  if (!ownerPackage) return null;

  const requireFromWeb = createRequire(resolve(WEB_ROOT, "package.json"));
  return resolveModulePackageDir(requireFromWeb.resolve(ownerPackage));
}

export function collectEmbeddedProvenance(assetFileNames: readonly string[]): EmbeddedProvenance[] {
  const provenance: EmbeddedProvenance[] = [];

  for (const owner of EMBEDDED_ASSET_PROVENANCE) {
    const matchedAssets = assetFileNames.filter((assetFileName) =>
      owner.assetPattern.test(assetFileName),
    );
    if (matchedAssets.length === 0) continue;
    if (!existsSync(owner.licensePath)) {
      throw new Error(`Missing embedded asset license at ${owner.licensePath}`);
    }
    provenance.push({
      labels: [...owner.labels],
      licenseText: normalizeLicenseText(readFileSync(owner.licensePath, "utf-8")),
    });
  }

  return provenance;
}

export function collectBundlePackages(modulePaths: readonly string[]): BundlePackage[] {
  const packageDirs = new Set<string>();
  for (const modulePath of modulePaths) {
    const packageDir =
      resolveModulePackageDir(modulePath) ?? resolveVirtualModulePackageDir(modulePath);
    if (packageDir) {
      packageDirs.add(packageDir);
      continue;
    }
    throw new Error(`Could not resolve package provenance for bundled module ${modulePath}`);
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

export function renderNotices(
  bundlePackages: readonly BundlePackage[],
  embeddedProvenance: readonly EmbeddedProvenance[] = [],
): string {
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
  for (const embedded of embeddedProvenance) {
    const labels = groups.get(embedded.licenseText) ?? new Set<string>();
    for (const label of embedded.labels) labels.add(label);
    groups.set(embedded.licenseText, labels);
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

export function collectRollupArtifacts(result: unknown): ViteBundleGraph {
  const outputs = Array.isArray(result) ? result : [result];
  const moduleIds = new Set<string>();
  const assetFileNames = new Set<string>();

  for (const output of outputs) {
    if (!isRecord(output) || !Array.isArray(output.output)) continue;
    for (const item of output.output) {
      if (!isRecord(item)) continue;
      if (item.type === "chunk" && isRecord(item.modules)) {
        // A fully tree-shaken module contributes no bytes to the emitted chunk, so its
        // package is not bundled and must not claim a notice under the header's promise.
        for (const [moduleId, renderedModule] of Object.entries(item.modules)) {
          if (isRecord(renderedModule) && renderedModule.renderedLength === 0) continue;
          moduleIds.add(moduleId);
        }
        continue;
      }
      if (item.type === "asset" && typeof item.fileName === "string") {
        assetFileNames.add(item.fileName);
      }
    }
  }

  if (moduleIds.size === 0) throw new Error("Vite returned no Rollup chunk modules");
  return {
    assetFileNames: [...assetFileNames].sort(),
    moduleIds: [...moduleIds].sort(),
  };
}

export async function collectViteBundleGraph(): Promise<ViteBundleGraph> {
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
  return collectRollupArtifacts(result);
}

export async function collectViteBundleModuleIds(): Promise<string[]> {
  return (await collectViteBundleGraph()).moduleIds;
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
  const viteBundleGraph = await collectViteBundleGraph();
  const tsupModuleIds = collectTsupBundleModuleIds(tsupMetafilePath);
  const bundlePackages = collectBundlePackages([...viteBundleGraph.moduleIds, ...tsupModuleIds]);
  const embeddedProvenance = collectEmbeddedProvenance(viteBundleGraph.assetFileNames);
  const text = renderNotices(bundlePackages, embeddedProvenance);
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
