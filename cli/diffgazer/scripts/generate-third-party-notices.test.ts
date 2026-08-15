import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const NOTICE_PATH = resolve(PACKAGE_ROOT, "THIRD_PARTY_NOTICES");
const TSUP_BIN = resolve(PACKAGE_ROOT, "node_modules/.bin/tsup");
const REQUIRED_PACKAGES = ["@tanstack/react-store", "@tanstack/store", "clsx", "tailwind-merge"];

type NoticeGenerator = typeof import("./generate-third-party-notices.js");

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

let generator: NoticeGenerator;
let tempDir: string;
let tsupMetafilePath: string;
let tsupModuleIds: string[];
let viteBundleGraph: { assetFileNames: string[]; moduleIds: string[] };
let viteModuleIds: string[];
let noticeTextBeforeImport: string;
let noticeMtimeBeforeImport: number;
let noticeTextAfterImport: string;
let noticeMtimeAfterImport: number;

beforeAll(async () => {
  noticeTextBeforeImport = readFileSync(NOTICE_PATH, "utf-8");
  noticeMtimeBeforeImport = statSync(NOTICE_PATH).mtimeMs;
  generator = await import("./generate-third-party-notices.js");
  noticeTextAfterImport = readFileSync(NOTICE_PATH, "utf-8");
  noticeMtimeAfterImport = statSync(NOTICE_PATH).mtimeMs;

  tempDir = mkdtempSync(resolve(tmpdir(), "diffgazer-notices-"));
  viteBundleGraph = await generator.collectViteBundleGraph();
  viteModuleIds = viteBundleGraph.moduleIds;

  const outDir = resolve(tempDir, "dist");
  execFileSync(TSUP_BIN, ["--metafile", "--out-dir", outDir], {
    cwd: PACKAGE_ROOT,
    stdio: "pipe",
  });
  tsupMetafilePath = resolve(outDir, "metafile-esm.json");
  tsupModuleIds = generator.collectTsupBundleModuleIds(tsupMetafilePath);
}, 60_000);

afterAll(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe("third-party notice bundle provenance", () => {
  it("has no import-time write side effect", () => {
    expect(noticeTextAfterImport).toBe(noticeTextBeforeImport);
    expect(noticeMtimeAfterImport).toBe(noticeMtimeBeforeImport);
  });

  it("maps every Vite bundle module to package provenance and retains frozen notices", () => {
    expect(() => generator.collectBundlePackages(viteModuleIds)).not.toThrow();

    const packages = generator.collectBundlePackages(viteModuleIds);
    const names = new Set(packages.map((bundlePackage) => bundlePackage.name));
    for (const packageName of REQUIRED_PACKAGES) expect(names).toContain(packageName);
    expect(names).toContain("vite");
  });

  it("omits packages whose every module was tree-shaken out of the emitted chunks", () => {
    const graph = generator.collectRollupArtifacts({
      output: [
        {
          type: "chunk",
          modules: {
            "/repo/node_modules/kept/index.js": { renderedLength: 128 },
            "/repo/node_modules/tree-shaken/index.js": { renderedLength: 0 },
          },
        },
      ],
    });

    expect(graph.moduleIds).toEqual(["/repo/node_modules/kept/index.js"]);
  });

  it("includes embedded font provenance for emitted web assets", () => {
    const embeddedProvenance = generator.collectEmbeddedProvenance(viteBundleGraph.assetFileNames);
    expect(viteBundleGraph.assetFileNames.some((asset) => asset.includes("jetbrains-mono"))).toBe(
      true,
    );
    expect(
      embeddedProvenance.some((entry) =>
        entry.labels.some((label) => label.includes("JetBrains Mono")),
      ),
    ).toBe(true);
  });

  it("fails closed instead of attributing an orphan dependency to its enclosing project", () => {
    const projectRoot = resolve(tempDir, "orphan-project");
    const orphanRoot = resolve(projectRoot, "node_modules/orphan-package");
    mkdirSync(orphanRoot, { recursive: true });
    writeFileSync(resolve(projectRoot, "package.json"), JSON.stringify({ name: "enclosing" }));
    writeFileSync(resolve(orphanRoot, "index.js"), "export {};\n");

    const orphanModule = resolve(orphanRoot, "index.js");
    expect(generator.resolveModulePackageDir(orphanModule)).toBeNull();
    expect(() => generator.collectBundlePackages([orphanModule])).toThrow(
      /Could not resolve package provenance/,
    );
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

  it("writes the rendered corpus and clears the tsup metafile only when asked", async () => {
    const outputPath = resolve(tempDir, "THIRD_PARTY_NOTICES.probe");
    const metafileProbe = resolve(tempDir, "metafile-probe.json");
    copyFileSync(tsupMetafilePath, metafileProbe);

    const kept = await generator.generateThirdPartyNotices({
      outputPath,
      removeTsupMetafile: false,
      tsupMetafilePath: metafileProbe,
    });

    expect(readFileSync(outputPath, "utf-8")).toBe(kept.text);
    expect(kept.text).toBe(readFileSync(NOTICE_PATH, "utf-8"));
    expect(kept.packageCount).toBeGreaterThan(0);
    expect(existsSync(metafileProbe)).toBe(true);

    const cleaned = await generator.generateThirdPartyNotices({
      outputPath,
      removeTsupMetafile: true,
      tsupMetafilePath: metafileProbe,
    });

    expect(cleaned.text).toBe(kept.text);
    expect(existsSync(metafileProbe)).toBe(false);
  }, 60_000);

  it("covers the real tsup input graph and ships the complete notice corpus in a packed tarball", () => {
    const packages = generator.collectBundlePackages([...viteModuleIds, ...tsupModuleIds]);
    const embeddedProvenance = generator.collectEmbeddedProvenance(viteBundleGraph.assetFileNames);
    const notices = generator.renderNotices(packages, embeddedProvenance);
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
    const sourceLicense = readFileSync(resolve(PACKAGE_ROOT, "LICENSE"), "utf-8");
    const packedNotices = readTarGzipEntry(tarballPath, "package/THIRD_PARTY_NOTICES");
    const distributionCorpus = [packedLicense, packedNotices].join("\n");

    expect(packedLicense).toBe(sourceLicense);

    expect(trackedNotices).toBe(notices);
    expect(packedNotices).toBe(trackedNotices);
    expect(packages.some((bundlePackage) => bundlePackage.name === "@diffgazer/server")).toBe(true);
    expect(packedNotices).toContain("JetBrains Mono");
    expect(packedNotices).toContain("vite@");
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
