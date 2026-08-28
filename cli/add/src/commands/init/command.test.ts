import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInitWorkflow } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { withProjectMutationLock } from "../../utils/mutation-lock.js";
import { initCommand } from "./command.js";
import { detectInitProject } from "./plan.js";
import { writeInitConfig } from "./topology.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-init-"));
  // src/ so detectProject reports sourceDir === "src" and plannedPaths target src/*.
  mkdirSync(join(root, "src"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
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

  function seedCatalogProject(spec: string, workspaceSource: string): void {
    seedPackageJson({
      name: "fixture",
      packageManager: "pnpm@11.13.0",
      devDependencies: { tailwindcss: spec },
    });
    writeFileSync(join(root, "pnpm-workspace.yaml"), workspaceSource);
  }

  function installTailwind(version: string): void {
    const tailwindDir = join(root, "node_modules/tailwindcss");
    mkdirSync(tailwindDir, { recursive: true });
    writeFileSync(
      join(tailwindDir, "package.json"),
      JSON.stringify({ name: "tailwindcss", version }),
    );
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

  test.each([
    ">=4 <5",
    ">=4.0.0 <5.0.0",
    "4.0.0 - 4.9.9",
  ])("accepts Tailwind v4 comparator and hyphen ranges: %s", async (tailwindVersion) => {
    seedProject(tailwindVersion);

    await runFixtureInit();

    expect(existsSync(join(root, "diffgazer.json"))).toBe(true);
  });

  test.each([
    ">=3 <4",
    ">=4 <6",
    "^3.4.17",
    ">=4",
    ">=4.0.0",
    ">=4 <=5",
    ">=4 <5 || >=6 <7",
    "4.0.0 - 4.9.9 || 6.0.0",
  ])("rejects Tailwind ranges that admit versions outside v4: %s", async (tailwindVersion) => {
    seedProject(tailwindVersion);

    await expect(runFixtureInit()).rejects.toThrow(/Tailwind CSS v4 is required/);
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
  });

  test.each([
    ["anonymous", "catalog:", "catalog:\n  tailwindcss: ^4.1.0\n"],
    ["named", "catalog:frontend", "catalogs:\n  frontend:\n    tailwindcss: '>=4 <5'\n"],
  ])("accepts a pnpm %s Tailwind v4 catalog without node_modules", async (_, spec, workspace) => {
    seedCatalogProject(spec, workspace);

    await runFixtureInit();

    expect(existsSync(join(root, "diffgazer.json"))).toBe(true);
  });

  test.each([
    ["v3", "catalog:", "catalog:\n  tailwindcss: ^3.4.17\n"],
    ["ambiguous", "catalog:frontend", "catalogs:\n  frontend:\n    tailwindcss: '>=4 <6'\n"],
    ["missing", "catalog:missing", "catalogs:\n  frontend:\n    tailwindcss: ^4.1.0\n"],
    ["nested anonymous", "catalog:", "catalog:\n  tooling:\n    tailwindcss: ^4.1.0\n"],
    [
      "nested named",
      "catalog:frontend",
      "catalogs:\n  frontend:\n    tooling:\n      tailwindcss: ^4.1.0\n",
    ],
    ["malformed", "catalog:", "catalog:\n  - tailwindcss: ^4.1.0\n"],
    ["duplicate", "catalog:", "catalog:\n  tailwindcss: ^4.1.0\n  tailwindcss: ^4.2.0\n"],
  ])("rejects a pnpm %s Tailwind catalog fallback", async (_, spec, workspace) => {
    seedCatalogProject(spec, workspace);

    await expect(runFixtureInit()).rejects.toThrow(/Tailwind CSS v4 is required/);
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
  });

  test("prefers the installed Tailwind v4 version over a stale declared range", async () => {
    seedProject("^3.4.17");
    installTailwind("4.1.0");

    await runFixtureInit();

    expect(existsSync(join(root, "diffgazer.json"))).toBe(true);
  });

  test("rejects installed Tailwind v3 even when the declared range requests v4", async () => {
    seedProject("^4.1.0");
    installTailwind("3.4.17");

    await expect(runFixtureInit()).rejects.toThrow(/Tailwind CSS v4 is required/);
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
  });

  test("requires a Tailwind declaration even when v4 is installed", async () => {
    seedProject();
    installTailwind("4.1.0");

    await expect(runFixtureInit()).rejects.toThrow(/tailwindcss was not found/);
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);
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

  test("waits for the shared project mutation lock before initialization", async () => {
    seedProject("^4.1.0");
    let releaseLock = () => {};
    let markLockAcquired = () => {};
    const lockAcquired = new Promise<void>((resolve) => {
      markLockAcquired = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const barrier = withProjectMutationLock(root, async () => {
      markLockAcquired();
      await release;
    });
    await lockAcquired;

    const initialization = initCommand.parseAsync([
      "node",
      "dgadd",
      "--cwd",
      root,
      "--yes",
      "--skip-install",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(existsSync(join(root, "diffgazer.json"))).toBe(false);

    releaseLock();
    await barrier;
    await initialization;
    expect(existsSync(join(root, "diffgazer.json"))).toBe(true);
  });
});
