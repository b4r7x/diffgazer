import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
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

async function writeExternalPackage(absoluteDir: string, name: string): Promise<void> {
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(join(absoluteDir, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
}

describe("discoverWorkspacePackages", () => {
  it("includes exact pnpm workspace package entries", async () => {
    await writeProjectFile(
      "pnpm-workspace.yaml",
      ["packages:", '  - "apps/*"', '  - "libs/*"', '  - "libs/keys/artifacts"', ""].join("\n"),
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
      ["packages:", '  - "packages/*"', '  - "packages/core"', ""].join("\n"),
    );
    await writePackage("packages/core", "@diffgazer/core");

    const packages = await discoverWorkspacePackages(projectRoot);

    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      name: "@diffgazer/core",
      dir: "packages/core",
    });
  });

  it("ignores symlinked workspace roots that escape the project root", async () => {
    const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-outside-"));
    try {
      await writeProjectFile(
        "pnpm-workspace.yaml",
        ["packages:", '  - "apps/*"', '  - "outside"', ""].join("\n"),
      );
      await writePackage("apps/web", "@diffgazer/web");
      await writePackage(join(outsideRoot, "escaped"), "@diffgazer/escaped");
      await symlink(join(outsideRoot, "escaped"), join(projectRoot, "outside"));

      const packages = await discoverWorkspacePackages(projectRoot);

      expect(packages.map((pkg) => pkg.name)).toEqual(["@diffgazer/web"]);
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it("ignores fallback workspace roots that symlink outside the project root", async () => {
    const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-outside-"));
    try {
      await writeExternalPackage(join(outsideRoot, "external"), "@diffgazer/external");
      await symlink(outsideRoot, join(projectRoot, "apps"));
      await writePackage("packages/local", "@diffgazer/local");

      const packages = await discoverWorkspacePackages(projectRoot);

      expect(packages.map((pkg) => pkg.name)).toEqual(["@diffgazer/local"]);
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it("ignores child package directories that symlink outside the project root", async () => {
    const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-outside-"));
    try {
      await writeProjectFile("pnpm-workspace.yaml", ["packages:", '  - "apps/*"', ""].join("\n"));
      await writePackage("apps/web", "@diffgazer/web");
      await writeExternalPackage(join(outsideRoot, "evil"), "@diffgazer/evil");
      await symlink(join(outsideRoot, "evil"), join(projectRoot, "apps", "evil"));

      const packages = await discoverWorkspacePackages(projectRoot);

      expect(packages.map((pkg) => pkg.name)).toEqual(["@diffgazer/web"]);
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it("ignores a symlinked package.json inside a contained child directory", async () => {
    const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-outside-"));
    try {
      await writeProjectFile("pnpm-workspace.yaml", ["packages:", '  - "apps/*"', ""].join("\n"));
      await writePackage("apps/web", "@diffgazer/web");
      await mkdir(join(projectRoot, "apps", "leaky"), { recursive: true });
      await writeExternalPackage(join(outsideRoot, "external"), "@diffgazer/external");
      await symlink(
        join(outsideRoot, "external", "package.json"),
        join(projectRoot, "apps", "leaky", "package.json"),
      );

      const packages = await discoverWorkspacePackages(projectRoot);

      expect(packages.map((pkg) => pkg.name)).toEqual(["@diffgazer/web"]);
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it("ignores malformed or schema-invalid package manifests", async () => {
    await writeProjectFile("pnpm-workspace.yaml", ["packages:", '  - "packages/*"', ""].join("\n"));
    await writeProjectFile("packages/bad-json/package.json", "{not-json");
    await writeProjectFile(
      "packages/bad-shape/package.json",
      JSON.stringify({ name: ["wrong"], dependencies: "nope" }),
    );
    await writePackage("packages/good", "@diffgazer/good");

    const packages = await discoverWorkspacePackages(projectRoot);

    expect(packages).toEqual([
      expect.objectContaining({ name: "@diffgazer/good", dir: "packages/good" }),
    ]);
  });
});
