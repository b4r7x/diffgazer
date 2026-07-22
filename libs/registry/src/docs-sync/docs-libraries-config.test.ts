import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getArtifactLibraries,
  parseDocsLibrariesConfig,
  readDocsLibrariesConfig,
} from "./docs-libraries-config.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(resolve(tmpdir(), "docs-sync-test-"));
  tempDirs.push(dir);
  return dir;
}

const VALID_CONFIG = {
  primaryLibraryId: "ui",
  libraries: [
    {
      id: "ui",
      enabled: true,
      artifactSource: { workspaceDir: "libs/ui" },
    },
    {
      id: "keys",
      enabled: true,
      artifactSource: { workspaceDir: "libs/keys" },
    },
  ],
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("sync artifacts helper config parsing", () => {
  it("parses docs libraries config and derives enabled artifact libraries", () => {
    const tempRoot = makeTempDir();
    const configPath = resolve(tempRoot, "docs-libraries.json");
    writeFileSync(configPath, JSON.stringify(VALID_CONFIG));

    const parsed = readDocsLibrariesConfig(configPath);
    const artifactLibraries = getArtifactLibraries(parsed);

    expect(parsed.primaryLibraryId).toBe("ui");
    expect(artifactLibraries).toEqual([
      { id: "ui", workspaceDir: "libs/ui" },
      { id: "keys", workspaceDir: "libs/keys" },
    ]);
  });

  it("rejects unsafe artifact library ids and workspace paths", () => {
    expect(() => parseDocsLibrariesConfig({ ...VALID_CONFIG, primaryLibraryId: "../ui" })).toThrow(
      /docs libraries config primaryLibraryId must be a safe library id/,
    );

    expect(() =>
      parseDocsLibrariesConfig({
        ...VALID_CONFIG,
        libraries: VALID_CONFIG.libraries.map((library) =>
          library.id === "ui"
            ? {
                ...library,
                artifactSource: { workspaceDir: "../libs/ui" },
              }
            : library,
        ),
      }),
    ).toThrow(
      /docs libraries config libraries\[0\]\.artifactSource\.workspaceDir must be a relative path without '\.\.' segments/,
    );
  });

  it("rejects duplicate library ids from different artifact sources", () => {
    expect(() =>
      parseDocsLibrariesConfig({
        ...VALID_CONFIG,
        libraries: [
          VALID_CONFIG.libraries[0],
          {
            id: "ui",
            enabled: true,
            artifactSource: { workspaceDir: "libs/ui-copy" },
          },
        ],
      }),
    ).toThrow(/docs libraries config libraries\[1\]\.id duplicates library id "ui"/);
  });
});
