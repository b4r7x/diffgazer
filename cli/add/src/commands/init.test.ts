import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PACKAGE_MANAGER_LOCKFILES, runInitWorkflow } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ctx, VERSION } from "../context.js";
import { buildInitPlannedPaths, detectInitProject, initCommand, writeInitConfig } from "./init.js";

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
  test("labels --reset-manifest as a recovery-only ownership-orphaning operation", () => {
    let help = "";
    initCommand.configureOutput({
      writeOut: (chunk) => {
        help += chunk;
      },
    });
    initCommand.outputHelp();

    expect(help).toContain("--reset-manifest");
    expect(help).toContain("Recovery only");
    expect(help).toContain("ownership ledger");
    expect(help).toMatch(/orphaning previously installed\s+files/);
  });

  test("includes package.json and every known lockfile so installer side effects can be rolled back", () => {
    const paths = buildInitPlannedPaths(root, { componentsDir: "src/components/ui" });

    expect(paths, "package.json must be planned for install-step rollback").toContain(
      "package.json",
    );
    for (const lockfile of PACKAGE_MANAGER_LOCKFILES) {
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

describe("dgadd init Tailwind prerequisite", () => {
  function seedPackageJson(packageJson: Record<string, unknown>): void {
    writeFileSync(join(root, "package.json"), JSON.stringify(packageJson));
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    );
  }

  function seedProject(tailwindVersion?: string): void {
    seedPackageJson({
      name: "fixture",
      packageManager: "npm@10.9.2",
      devDependencies: tailwindVersion ? { tailwindcss: tailwindVersion } : {},
    });
  }

  async function runFixtureInit(): Promise<void> {
    await runInitWorkflow({
      cwd: root,
      configFileName: "diffgazer.json",
      yes: true,
      force: false,
      skipInstall: true,
      loadConfig: () => ({ ok: false, error: "not_found" }),
      detectProject: (cwd) => detectInitProject(cwd, { componentsDir: "src/components/ui" }),
      plannedPaths: () => ["mutation.txt"],
      createFiles: (cwd) => {
        writeFileSync(join(cwd, "mutation.txt"), "created");
        return [{ action: "created", path: "mutation.txt" }];
      },
      writeConfig: (cwd) => writeInitConfig(cwd, { componentsDir: "src/components/ui" }),
      nextSteps: [],
    });
  }

  test("rejects a missing Tailwind dependency before creating files or config", async () => {
    seedProject();

    await expect(runFixtureInit()).rejects.toThrow(
      /Tailwind CSS v4 is required.*tailwindcss was not found.*Install it with .*tailwindcss@\^4/s,
    );

    expect(existsSync(join(root, "mutation.txt"))).toBe(false);
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
  });

  test("rejects Tailwind v3 before creating files or config", async () => {
    seedProject("^3.4.17");

    await expect(runFixtureInit()).rejects.toThrow(
      /Tailwind CSS v4 is required.*declares tailwindcss "\^3\.4\.17".*Install it with .*tailwindcss@\^4/s,
    );

    expect(existsSync(join(root, "mutation.txt"))).toBe(false);
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
  });

  test("continues initialization when package.json declares Tailwind v4", async () => {
    seedProject("^4.1.0");

    await runFixtureInit();

    expect(readFileSync(join(root, "mutation.txt"), "utf8")).toBe("created");
    expect(existsSync(join(root, "diffgazer.json"))).toBe(true);
  });

  test("rejects a numeric Tailwind version before creating files or config", async () => {
    seedPackageJson({
      name: "fixture",
      packageManager: "npm@10.9.2",
      devDependencies: { tailwindcss: 4 },
    });

    await expect(runFixtureInit()).rejects.toThrow(/tailwindcss was not found/);
    expect(existsSync(join(root, "mutation.txt"))).toBe(false);
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
  });

  test("ignores a numeric Next.js version without crashing before writes", async () => {
    seedPackageJson({
      name: "fixture",
      packageManager: "npm@10.9.2",
      dependencies: { next: 15 },
      devDependencies: { tailwindcss: "^4.1.0" },
    });

    await runFixtureInit();

    expect(readFileSync(join(root, "mutation.txt"), "utf8")).toBe("created");
  });

  test("falls back from a numeric packageManager without crashing before writes", async () => {
    seedPackageJson({
      name: "fixture",
      packageManager: 10,
      devDependencies: { tailwindcss: "^4.1.0" },
    });

    await runFixtureInit();

    expect(readFileSync(join(root, "mutation.txt"), "utf8")).toBe("created");
  });

  test("continues initialization with a trailing-comma JSONC path alias", async () => {
    seedProject("^4.1.0");
    writeFileSync(
      join(root, "tsconfig.json"),
      ["{", '  "compilerOptions": {', '    "paths": { "@/*": ["./src/*",], },', "  },", "}"].join(
        "\n",
      ),
    );

    await runFixtureInit();

    expect(readFileSync(join(root, "mutation.txt"), "utf8")).toBe("created");
    expect(existsSync(join(root, "diffgazer.json"))).toBe(true);
  });

  test("accepts a source alias inherited from a package-name tsconfig base", async () => {
    seedProject("^4.1.0");
    const packageDir = join(root, "node_modules/@fixture/tsconfig");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      join(packageDir, "package.json"),
      JSON.stringify({ name: "@fixture/tsconfig", tsconfig: "./base.json" }),
    );
    writeFileSync(
      join(packageDir, "base.json"),
      JSON.stringify({
        compilerOptions: { baseUrl: "../../../src", paths: { "~/*": ["*"] } },
      }),
    );
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ extends: "@fixture/tsconfig" }));

    await runFixtureInit();

    expect(readFileSync(join(root, "mutation.txt"), "utf8")).toBe("created");
    expect(existsSync(join(root, "diffgazer.json"))).toBe(true);
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
