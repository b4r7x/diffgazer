import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverWorkspacePackages } from "./workspace-discovery.js";

const execFileAsync = promisify(execFile);

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

async function listPnpmWorkspaceDirs(): Promise<string[]> {
  const physicalRoot = await realpath(projectRoot);
  const { stdout } = await execFileAsync(
    "pnpm",
    ["--recursive", "--depth", "-1", "list", "--json"],
    { cwd: projectRoot, env: { ...process.env, npm_config_offline: "true" }, timeout: 10_000 },
  );
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed)) throw new Error("pnpm list fixture output is not an array");

  return parsed.map((entry) => {
    if (entry === null || typeof entry !== "object" || !("path" in entry)) {
      throw new Error("pnpm list fixture entry is missing path");
    }
    if (typeof entry.path !== "string") {
      throw new Error("pnpm list fixture path is not a string");
    }
    return relative(physicalRoot, entry.path).split("\\").join("/") || ".";
  });
}

describe("discoverWorkspacePackages", () => {
  it("matches pnpm for recursive and brace globs, quoted entries, comments, and negation", async () => {
    await writeProjectFile("package.json", JSON.stringify({ name: "fixture-root" }));
    await writeProjectFile(
      "pnpm-workspace.yaml",
      [
        "packages:",
        '  - "apps/*" # quoted entry with a comment',
        "  - 'packages/{core,plugins/**}'",
        '  - "!packages/plugins/ignored/**"',
        "",
      ].join("\n"),
    );
    await writePackage("apps/web", "fixture-web");
    await writePackage("packages/core", "fixture-core");
    await writePackage("packages/plugins/nested/tool", "fixture-tool");
    await writePackage("packages/plugins/ignored/private", "fixture-ignored");
    await writePackage("packages/unmatched", "fixture-unmatched");

    const packages = await discoverWorkspacePackages(projectRoot);
    const pnpmDirs = await listPnpmWorkspaceDirs();

    expect(packages.map((pkg) => pkg.dir)).toEqual(pnpmDirs);
    expect(packages.map((pkg) => pkg.name)).toEqual([
      "fixture-root",
      "fixture-web",
      "fixture-core",
      "fixture-tool",
    ]);
  });

  it("fails explicitly when local pnpm is unavailable instead of using the partial fallback", async () => {
    await writeProjectFile("pnpm-workspace.yaml", "packages:\n  - 'apps/*'\n");
    await writePackage("apps/web", "fixture-web");
    const runPnpmList = vi.fn().mockRejectedValue(new Error("spawn pnpm ENOENT"));

    await expect(discoverWorkspacePackages(projectRoot, { runPnpmList })).rejects.toThrow(
      /local pnpm CLI: spawn pnpm ENOENT/,
    );
    expect(runPnpmList).toHaveBeenCalledOnce();
    expect(runPnpmList).toHaveBeenCalledWith(projectRoot);
  });

  it.each([
    ["malformed JSON", "not-json", /invalid JSON/],
    ["invalid shape", "[]", /invalid shape/],
  ])("rejects %s from pnpm rather than guessing workspace semantics", async (_case, stdout, error) => {
    await writeProjectFile("pnpm-workspace.yaml", "packages:\n  - 'apps/*'\n");

    await expect(
      discoverWorkspacePackages(projectRoot, { runPnpmList: async () => stdout }),
    ).rejects.toThrow(error);
  });

  it("applies realpath containment to every path returned by pnpm", async () => {
    const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-outside-"));
    try {
      await writeProjectFile("package.json", JSON.stringify({ name: "fixture-root" }));
      await writeProjectFile("pnpm-workspace.yaml", "packages:\n  - 'packages/**'\n");
      await writeExternalPackage(outsideRoot, "fixture-outside");

      const packages = await discoverWorkspacePackages(projectRoot, {
        runPnpmList: async () => JSON.stringify([{ path: projectRoot }, { path: outsideRoot }]),
      });

      expect(packages.map((pkg) => pkg.name)).toEqual(["fixture-root"]);
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

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

  it("surfaces pnpm failure for a malformed workspace package manifest", async () => {
    await writeProjectFile("pnpm-workspace.yaml", ["packages:", '  - "packages/*"', ""].join("\n"));
    await writeProjectFile("packages/bad-json/package.json", "{not-json");

    await expect(discoverWorkspacePackages(projectRoot)).rejects.toThrow(
      /Failed to resolve pnpm workspace/,
    );
  });

  it("ignores schema-invalid manifests in an otherwise valid resolved workspace list", async () => {
    await writeProjectFile("pnpm-workspace.yaml", ["packages:", '  - "packages/*"', ""].join("\n"));
    await writeProjectFile(
      "packages/bad-shape/package.json",
      JSON.stringify({ name: ["wrong"], dependencies: "nope" }),
    );
    await writePackage("packages/good", "@diffgazer/good");

    const packages = await discoverWorkspacePackages(projectRoot, {
      runPnpmList: async () =>
        JSON.stringify([
          { path: join(projectRoot, "packages/bad-shape") },
          { path: join(projectRoot, "packages/good") },
        ]),
    });

    expect(packages).toEqual([
      expect.objectContaining({ name: "@diffgazer/good", dir: "packages/good" }),
    ]);
  });
});
