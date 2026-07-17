import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const NOTICE_PATH = resolve(PACKAGE_ROOT, "THIRD_PARTY_NOTICES");
const TSUP_BIN = resolve(PACKAGE_ROOT, "node_modules/.bin/tsup");
const REQUIRED_PACKAGES = ["@tanstack/react-store", "@tanstack/store", "clsx", "tailwind-merge"];

interface BundlePackage {
  licenseText: string | null;
  name: string;
  packageDir: string;
}

interface NoticeGenerator {
  collectBundlePackages: (modulePaths: readonly string[]) => BundlePackage[];
  collectTsupBundleModuleIds: (metafilePath: string) => string[];
  collectViteBundleModuleIds: () => Promise<string[]>;
  generateThirdPartyNotices: (...args: unknown[]) => Promise<unknown>;
  renderNotices: (packages: readonly BundlePackage[]) => string;
  resolveModulePackageDir: (modulePath: string) => string | null;
}

function getPackedTarballName(stdout: string): string {
  const value: unknown = JSON.parse(stdout);
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error("npm pack returned an invalid result");
  }
  const packResult: unknown = value[0];
  if (
    typeof packResult !== "object" ||
    packResult === null ||
    !("filename" in packResult) ||
    typeof packResult.filename !== "string"
  ) {
    throw new Error("npm pack result has no tarball filename");
  }
  return packResult.filename;
}

function readTarGzipEntry(tarballPath: string, entryPath: string): string {
  const archive = gunzipSync(readFileSync(tarballPath));
  let offset = 0;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const readField = (start: number, length: number) =>
      header
        .subarray(start, start + length)
        .toString("utf-8")
        .replace(/\0.*$/s, "")
        .trim();
    const name = readField(0, 100);
    const prefix = readField(345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    const size = Number.parseInt(readField(124, 12) || "0", 8);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Invalid tar entry size for ${path}`);
    }

    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > archive.length) throw new Error(`Truncated tar entry: ${path}`);
    if (path === entryPath) return archive.subarray(contentStart, contentEnd).toString("utf-8");

    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  throw new Error(`Missing tar entry: ${entryPath}`);
}

function isNoticeGenerator(value: unknown): value is NoticeGenerator {
  if (typeof value !== "object" || value === null) return false;
  return (
    "collectBundlePackages" in value &&
    typeof value.collectBundlePackages === "function" &&
    "collectTsupBundleModuleIds" in value &&
    typeof value.collectTsupBundleModuleIds === "function" &&
    "collectViteBundleModuleIds" in value &&
    typeof value.collectViteBundleModuleIds === "function" &&
    "generateThirdPartyNotices" in value &&
    typeof value.generateThirdPartyNotices === "function" &&
    "renderNotices" in value &&
    typeof value.renderNotices === "function" &&
    "resolveModulePackageDir" in value &&
    typeof value.resolveModulePackageDir === "function"
  );
}

let generator: NoticeGenerator;
let tempDir: string;
let viteModuleIds: string[];

beforeAll(async () => {
  const beforeText = readFileSync(NOTICE_PATH, "utf-8");
  const beforeMtime = statSync(NOTICE_PATH).mtimeMs;
  const moduleUrl = new URL("../scripts/generate-third-party-notices.ts", import.meta.url).href;
  const imported: unknown = await import(moduleUrl);
  if (!isNoticeGenerator(imported)) throw new Error("Invalid notice generator module");
  generator = imported;

  expect(readFileSync(NOTICE_PATH, "utf-8")).toBe(beforeText);
  expect(statSync(NOTICE_PATH).mtimeMs).toBe(beforeMtime);

  tempDir = mkdtempSync(resolve(tmpdir(), "diffgazer-notices-"));
  viteModuleIds = await generator.collectViteBundleModuleIds();
});

afterAll(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe("third-party notice bundle provenance", () => {
  it("has no import-time write side effect", () => {
    expect(generator.generateThirdPartyNotices).toBeTypeOf("function");
  });

  it("maps every real Vite bundle module to package provenance and retains frozen notices", () => {
    const nodeModuleIds = viteModuleIds.filter((moduleId) => moduleId.includes("/node_modules/"));
    const packages = generator.collectBundlePackages(viteModuleIds);

    for (const moduleId of nodeModuleIds) {
      expect(
        generator.resolveModulePackageDir(moduleId),
        `missing package provenance for ${moduleId}`,
      ).not.toBeNull();
    }

    const names = new Set(packages.map((bundlePackage) => bundlePackage.name));
    for (const packageName of REQUIRED_PACKAGES) expect(names).toContain(packageName);
  });

  it.each([
    "/missing/node_modules/unresolved-package/index.js",
    "node_modules/unresolved-package/index.js",
    "C:\\missing\\node_modules\\unresolved-package\\index.js",
  ])("fails closed when third-party bundle input %s has no package provenance", (moduleId) => {
    expect(() => generator.collectBundlePackages([moduleId])).toThrow(
      /Could not resolve package provenance/,
    );
  });

  it("covers the real tsup input graph and ships the complete notice corpus in a packed tarball", () => {
    const outDir = resolve(tempDir, "dist");
    execFileSync(TSUP_BIN, ["--metafile", "--out-dir", outDir], {
      cwd: PACKAGE_ROOT,
      stdio: "pipe",
    });
    const tsupModuleIds = generator.collectTsupBundleModuleIds(
      resolve(outDir, "metafile-esm.json"),
    );
    const packages = generator.collectBundlePackages([...viteModuleIds, ...tsupModuleIds]);
    const notices = generator.renderNotices(packages);
    const trackedNotices = readFileSync(NOTICE_PATH, "utf-8");

    for (const moduleId of tsupModuleIds) {
      const packageDir = generator.resolveModulePackageDir(moduleId);
      expect(packageDir, `missing package provenance for ${moduleId}`).not.toBeNull();
      expect(
        packages.some((bundlePackage) => bundlePackage.packageDir === packageDir),
        `missing collected package provenance for ${moduleId}`,
      ).toBe(true);
    }

    const packOutput = execFileSync(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", tempDir],
      { cwd: PACKAGE_ROOT, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const tarballPath = resolve(tempDir, getPackedTarballName(packOutput));
    const packedLicense = readTarGzipEntry(tarballPath, "package/LICENSE");
    const packedNotices = readTarGzipEntry(tarballPath, "package/THIRD_PARTY_NOTICES");
    const distributionCorpus = [packedLicense, packedNotices].join("\n");

    expect(trackedNotices).toBe(notices);
    expect(packedNotices).toBe(trackedNotices);
    expect(packages.some((bundlePackage) => bundlePackage.name === "@diffgazer/server")).toBe(true);
    for (const packageName of REQUIRED_PACKAGES) {
      const bundlePackage = packages.find((candidate) => candidate.name === packageName);
      if (!bundlePackage?.licenseText) throw new Error(`Missing ${packageName} license text`);
      expect(packedNotices).toContain(packageName);
      expect(distributionCorpus).toContain(bundlePackage.licenseText);
    }

    const distinctFrozenTexts = new Set(
      packages
        .filter((bundlePackage) => REQUIRED_PACKAGES.includes(bundlePackage.name))
        .map((bundlePackage) => bundlePackage.licenseText)
        .filter((licenseText): licenseText is string => licenseText !== null),
    );
    for (const licenseText of distinctFrozenTexts) {
      expect(packedNotices.split(licenseText)).toHaveLength(2);
    }
  }, 30_000);
});
