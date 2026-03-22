import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertArtifactSyncOutputs,
  collectArtifactSyncValidationErrors,
  getArtifactLibraries,
  parseDocsLibrariesConfig,
  readDocsLibrariesConfig,
  resolveArtifactSyncMode,
} from "./sync-artifacts-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(__dirname, "..");
const configPath = resolve(docsRoot, "config/docs-libraries.json");

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir() {
  const dir = mkdtempSync(resolve(tmpdir(), "docs-sync-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(root: string, relPath: string, content = "{}\n") {
  const absPath = resolve(root, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content);
}

describe("sync artifacts helper config parsing", () => {
  it("parses docs libraries config and derives enabled artifact libraries", () => {
    const parsed = readDocsLibrariesConfig(configPath);
    const artifactLibraries = getArtifactLibraries(parsed);

    expect(parsed.primaryLibraryId).toBe("diff-ui");
    expect(artifactLibraries).toEqual([
      {
        id: "diff-ui",
        packageName: "@b4r7x/diff-ui-artifacts",
        workspaceDir: "diff-ui",
      },
      {
        id: "keyscope",
        packageName: "@b4r7x/keyscope-artifacts",
        workspaceDir: "keyscope",
      },
      {
        id: "diffgazer",
        packageName: "@b4r7x/diffgazer-artifacts",
        workspaceDir: "diffgazer",
      },
    ]);
  });

  it("rejects malformed artifact library config", () => {
    const rawConfig = JSON.parse(readFileSync(configPath, "utf-8")) as {
      primaryLibraryId: string;
      libraries: Array<Record<string, unknown>>;
    };

    const broken = {
      ...rawConfig,
      libraries: rawConfig.libraries.map((library) =>
        library.id === "diff-ui"
          ? {
              ...library,
              artifactSource: {
                workspaceDir: "diff-ui",
                packageName: "",
              },
            }
          : library,
      ),
    };

    expect(() => parseDocsLibrariesConfig(broken)).toThrow();
  });

  it("switches sync mode based on DIFFGAZER_DEV", () => {
    expect(resolveArtifactSyncMode({} as NodeJS.ProcessEnv)).toBe("package");
    expect(
      resolveArtifactSyncMode({ DIFFGAZER_DEV: "1" } as NodeJS.ProcessEnv),
    ).toBe("workspace");
  });

  it("auto-falls back to workspace when local artifact packages are not resolvable", () => {
    const mode = resolveArtifactSyncMode({} as NodeJS.ProcessEnv, {
      libraries: [
        {
          id: "diff-ui",
          packageName: "@b4r7x/diff-ui-artifacts",
          workspaceDir: "diff-ui",
        },
        {
          id: "keyscope",
          packageName: "@b4r7x/keyscope-artifacts",
          workspaceDir: "keyscope",
        },
      ],
      resolvePackage: (packageName: string) =>
        packageName !== "@b4r7x/diff-ui-artifacts",
    });

    expect(mode).toBe("workspace");
  });

  it("keeps package mode in CI even when artifact packages are not resolvable", () => {
    const mode = resolveArtifactSyncMode({ CI: "true" } as NodeJS.ProcessEnv, {
      libraries: [
        {
          id: "diff-ui",
          packageName: "@b4r7x/diff-ui-artifacts",
          workspaceDir: "diff-ui",
        },
      ],
      resolvePackage: () => false,
    });

    expect(mode).toBe("package");
  });

  it("keeps package mode when local artifact packages are resolvable", () => {
    const mode = resolveArtifactSyncMode({} as NodeJS.ProcessEnv, {
      libraries: [
        {
          id: "diff-ui",
          packageName: "@b4r7x/diff-ui-artifacts",
          workspaceDir: "diff-ui",
        },
      ],
      resolvePackage: () => true,
    });

    expect(mode).toBe("package");
  });
});

describe("sync artifacts helper output validation", () => {
  it("accepts the current checked-in generated namespace outputs", () => {
    const parsed = readDocsLibrariesConfig(configPath);
    const artifactLibraries = getArtifactLibraries(parsed);

    expect(() =>
      assertArtifactSyncOutputs({
        docsRoot,
        primaryLibraryId: parsed.primaryLibraryId,
        libraries: artifactLibraries,
      }),
    ).not.toThrow();
  });

  it("reports missing namespace outputs and primary mismatch", () => {
    const tempRoot = makeTempDir();

    writeFile(tempRoot, "content/docs/meta.json");
    writeFile(tempRoot, "registry/registry.json");
    writeFile(tempRoot, "styles/styles.css", "/* styles */\n");
    writeFile(tempRoot, "content/docs/diff-ui/meta.json");
    writeFile(tempRoot, "public/r/diff-ui/registry.json");
    mkdirSync(resolve(tempRoot, "src/generated/diff-ui"), { recursive: true });

    const errors = collectArtifactSyncValidationErrors({
      docsRoot: tempRoot,
      primaryLibraryId: "keyscope",
      libraries: [
        {
          id: "diff-ui",
          packageName: "@b4r7x/diff-ui-artifacts",
          workspaceDir: "diff-ui",
        },
      ],
    });

    expect(errors).toContain(
      'Primary library "keyscope" is not present in enabled artifact libraries: diff-ui',
    );
    expect(errors).toContain(
      "Generated namespace is empty: src/generated/diff-ui",
    );
  });
});
