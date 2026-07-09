import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInitWorkflow } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ctx, VERSION } from "../context.js";
import { buildInitPlannedPaths, KNOWN_LOCKFILES, writeInitConfig } from "./init.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-init-rollback-"));
  // src/ so detectProject reports sourceDir === "src" and plannedPaths target src/*.
  mkdirSync(join(root, "src"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("dgadd init plannedPaths", () => {
  test("includes package.json and every known lockfile so installer side effects can be rolled back", () => {
    const paths = buildInitPlannedPaths(root, { componentsDir: "src/components/ui" });

    expect(paths, "package.json must be planned for install-step rollback").toContain(
      "package.json",
    );
    for (const lockfile of KNOWN_LOCKFILES) {
      expect(
        paths,
        `lockfile ${lockfile} must be planned so a fresh-create on install is undone on rollback`,
      ).toContain(lockfile);
    }
  });

  test("includes the resolved source-tree directories and seed files", () => {
    const paths = buildInitPlannedPaths(root, { componentsDir: "src/components/ui" });

    expect(paths).toContain("src/components/ui/");
    expect(paths).toContain("src/hooks/");
    expect(paths).toContain("src/lib/utils.ts");
    expect(paths).toContain("src/styles/theme.css");
    expect(paths).toContain("src/styles/styles.css");
  });
});

describe("dgadd init rollback after install side effects", () => {
  test("restores package.json and removes a freshly-created lockfile when writeConfig fails after install", async () => {
    const originalPackageJson = `${JSON.stringify({ name: "fixture", type: "module" }, null, 2)}\n`;
    writeFileSync(join(root, "package.json"), originalPackageJson);

    await expect(
      runInitWorkflow({
        cwd: root,
        configFileName: "diffgazer.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: (cwd) => buildInitPlannedPaths(cwd, { componentsDir: "src/components/ui" }),
        createFiles: () => [],
        afterFiles: async (cwd) => {
          const mutated = `${JSON.stringify(
            { name: "fixture", type: "module", dependencies: { clsx: "^2.0.0" } },
            null,
            2,
          )}\n`;
          writeFileSync(join(cwd, "package.json"), mutated);
          writeFileSync(join(cwd, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
        },
        writeConfig: () => {
          throw new Error("simulated writeConfig failure");
        },
        nextSteps: [],
      }),
    ).rejects.toThrow(/simulated writeConfig failure/);

    expect(
      readFileSync(join(root, "package.json"), "utf-8"),
      "package.json must be restored to its pre-init bytes",
    ).toBe(originalPackageJson);
    expect(
      existsSync(join(root, "pnpm-lock.yaml")),
      "freshly-created lockfile must be removed on rollback",
    ).toBe(false);
    expect(
      existsSync(join(root, "diffgazer.json")),
      "config file must not be left behind when writeConfig throws before completion",
    ).toBe(false);
  });

  test("restores a pre-existing lockfile content when writeConfig fails after install", async () => {
    const originalPackageJson = `${JSON.stringify({ name: "fixture" }, null, 2)}\n`;
    const originalLockfile = "lockfileVersion: '9.0'\n# original\n";
    writeFileSync(join(root, "package.json"), originalPackageJson);
    writeFileSync(join(root, "pnpm-lock.yaml"), originalLockfile);

    await expect(
      runInitWorkflow({
        cwd: root,
        configFileName: "diffgazer.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: (cwd) => buildInitPlannedPaths(cwd, { componentsDir: "src/components/ui" }),
        createFiles: () => [],
        afterFiles: async (cwd) => {
          writeFileSync(
            join(cwd, "package.json"),
            JSON.stringify({ name: "fixture", dependencies: {} }),
          );
          writeFileSync(join(cwd, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n# mutated\n");
        },
        writeConfig: () => {
          throw new Error("boom");
        },
        nextSteps: [],
      }),
    ).rejects.toThrow(/boom/);

    expect(readFileSync(join(root, "package.json"), "utf-8")).toBe(originalPackageJson);
    expect(readFileSync(join(root, "pnpm-lock.yaml"), "utf-8")).toBe(originalLockfile);
  });
});

describe("dgadd init --force manifest ownership preservation", () => {
  const priorConfig = {
    $schema: "https://example.test/schema/diffgazer.json",
    version: "0.0.0-prior",
    aliases: {
      components: "@/components/ui",
      utils: "@/lib/utils",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    componentsFsPath: "src/components/ui",
    libFsPath: "src/lib",
    hooksFsPath: "src/hooks",
    rsc: false,
    tailwind: { css: "src/styles/styles.css" },
    installedComponents: {
      "ui/button": {
        installedAt: "2026-01-01T00:00:00.000Z",
        installedAs: "explicit",
        cssChunks: ["0123456789abcdef"],
        files: [
          { path: "src/components/ui/button.tsx", hash: "deadbeefcafef00d", item: "ui/button" },
        ],
      },
    },
  };

  function seedInstalledProject(withPriorConfig: boolean): void {
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify({ name: "fixture", type: "module" }, null, 2)}\n`,
    );
    writeFileSync(
      join(root, "tsconfig.json"),
      `${JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }, null, 2)}\n`,
    );
    if (withPriorConfig) {
      writeFileSync(join(root, "diffgazer.json"), `${JSON.stringify(priorConfig, null, 2)}\n`);
    }
  }

  test("carries installedComponents across a forced re-init so remove/diff still see ownership", () => {
    seedInstalledProject(true);

    writeInitConfig(root, { componentsDir: "src/components/ui" });

    const manifest = ctx.config.getManifestItems(root);
    expect(manifest, "the ownership ledger remove/diff read must survive re-init").toBeDefined();
    const entry = manifest?.["ui/button"];
    expect(entry?.files?.[0]?.hash).toBe("deadbeefcafef00d");
    expect(entry?.cssChunks).toEqual(["0123456789abcdef"]);

    const rewritten = ctx.config.loadConfig(root);
    if (!rewritten.ok) throw new Error("expected the rewritten config to load");
    expect(rewritten.config.version).toBe(VERSION);
  });

  test("drops the manifest only when --reset-manifest is explicitly passed", () => {
    seedInstalledProject(true);

    writeInitConfig(root, { componentsDir: "src/components/ui", resetManifest: true });

    expect(ctx.config.getManifestItems(root)).toBeUndefined();
  });

  test("does not fabricate a manifest on a fresh init with no prior ledger", () => {
    seedInstalledProject(false);

    writeInitConfig(root, { componentsDir: "src/components/ui" });

    expect(ctx.config.getManifestItems(root)).toBeUndefined();
  });
});
