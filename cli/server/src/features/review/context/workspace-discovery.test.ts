import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverWorkspacePackages } from "./workspace-discovery.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "diffgazer-workspace-"));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

async function writeProjectFile(relativePath: string, content: string): Promise<void> {
  const absolutePath = join(projectRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf-8");
}

async function writePackage(relativePath: string, name: string): Promise<void> {
  await writeProjectFile(
    join(relativePath, "package.json"),
    JSON.stringify({ name, version: "1.0.0" }),
  );
}

describe("discoverWorkspacePackages", () => {
  it("includes exact pnpm workspace package entries", async () => {
    await writeProjectFile(
      "pnpm-workspace.yaml",
      [
        "packages:",
        '  - "apps/*"',
        '  - "libs/*"',
        '  - "libs/keys/artifacts"',
        "",
      ].join("\n"),
    );
    await writePackage("apps/web", "@diffgazer/web");
    await writePackage("libs/keys", "@diffgazer/keys");
    await writePackage("libs/keys/artifacts", "@diffgazer/keys-artifacts");

    const packages = await discoverWorkspacePackages(projectRoot);

    expect(packages.map((pkg) => pkg.name)).toEqual([
      "@diffgazer/web",
      "@diffgazer/keys",
      "@diffgazer/keys-artifacts",
    ]);
    expect(packages.find((pkg) => pkg.name === "@diffgazer/keys-artifacts")).toMatchObject({
      dir: "libs/keys/artifacts",
      kind: "package",
    });
  });

  it("deduplicates packages matched by both a glob and an exact entry", async () => {
    await writeProjectFile(
      "pnpm-workspace.yaml",
      [
        "packages:",
        '  - "packages/*"',
        '  - "packages/core"',
        "",
      ].join("\n"),
    );
    await writePackage("packages/core", "@diffgazer/core");

    const packages = await discoverWorkspacePackages(projectRoot);

    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      name: "@diffgazer/core",
      dir: "packages/core",
    });
  });
});
