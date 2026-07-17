import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { createCli, PACKAGE_MANAGER_LOCKFILES, withFileLock } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx } from "../../context.js";
import { publicAvailableNames } from "../../utils/namespaces.js";
import { computeMissingDeps, createDiffgazerAddCommand } from "./command.js";
import { assertIntegrationModeChangesAllowed } from "./manifest.js";

let root: string;
let fakeBin: string | undefined;
let originalPath: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-add-deps-"));
  originalPath = process.env.PATH;
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "fixture",
      dependencies: {
        "@diffgazer/keys": "^0.1.0",
        clsx: "^2.0.0",
      },
    }),
  );
});

afterEach(() => {
  process.env.PATH = originalPath;
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
  if (fakeBin) rmSync(fakeBin, { recursive: true, force: true });
  fakeBin = undefined;
});

function snapshotSourceFiles(cwd: string): Map<string, Buffer> {
  const sourceRoot = join(cwd, "src");
  const snapshots = new Map<string, Buffer>();
  if (!existsSync(sourceRoot)) return snapshots;

  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) snapshots.set(relative(cwd, path), readFileSync(path));
    }
  };
  visit(sourceRoot);
  return snapshots;
}

function snapshotLockfiles(cwd: string): Map<string, Buffer | null> {
  return new Map(
    PACKAGE_MANAGER_LOCKFILES.map((name) => {
      const path = join(cwd, name);
      return [name, existsSync(path) ? readFileSync(path) : null] as const;
    }),
  );
}

function readInstalledComponents(cwd: string): Record<string, unknown> {
  const manifest = JSON.parse(readFileSync(join(cwd, "diffgazer.json"), "utf-8")) as {
    installedComponents?: Record<string, unknown>;
  };
  return manifest.installedComponents ?? {};
}

function readInstalledAs(cwd: string, name: string): unknown {
  const installed = readInstalledComponents(cwd)[name];
  if (typeof installed !== "object" || installed === null || !("installedAs" in installed)) {
    return undefined;
  }
  return installed.installedAs;
}

function writeAddConfig(cwd: string): void {
  writeFileSync(
    join(cwd, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
  );
  writeFileSync(
    join(cwd, "diffgazer.json"),
    JSON.stringify({
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      componentsFsPath: "src/components/ui",
      libFsPath: "src/lib",
      hooksFsPath: "src/hooks",
      tailwind: { css: "src/styles/styles.css" },
    }),
  );
  mkdirSync(join(cwd, "src/styles"), { recursive: true });
  writeFileSync(join(cwd, "src/styles/styles.css"), '@import "./theme.css";\n');
}

function createAddTestCli(name: string) {
  return createCli({
    name,
    displayName: "DIFFGAZER ADD TEST",
    description: "actual add command test",
    version: "0.0.0",
    commands: [createDiffgazerAddCommand()],
  });
}

describe("computeMissingDeps keys-version policy", () => {
  test("re-adds @diffgazer/keys when an explicit --keys-version differs from package.json", () => {
    const missing = computeMissingDeps(
      ["select"],
      { mode: "@diffgazer/keys", hasKeyboardIntegration: true },
      "^0.3.0",
      root,
    );

    expect(missing).toContain("@diffgazer/keys@^0.3.0");
  });

  test("skips @diffgazer/keys when the installed range already matches --keys-version", () => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "fixture",
        dependencies: { "@diffgazer/keys": "^0.3.0", clsx: "^2.0.0" },
      }),
    );

    const missing = computeMissingDeps(
      ["select"],
      { mode: "@diffgazer/keys", hasKeyboardIntegration: true },
      "^0.3.0",
      root,
    );

    expect(missing.some((dep) => dep.startsWith("@diffgazer/keys@"))).toBe(false);
  });
});

describe("integration mode planning", () => {
  test("requires overwrite before changing an installed mode", () => {
    expect(() =>
      assertIntegrationModeChangesAllowed(["ui/select"], "@diffgazer/keys", false),
    ).toThrow(/--overwrite/);

    expect(() =>
      assertIntegrationModeChangesAllowed(["ui/select"], "@diffgazer/keys", true),
    ).not.toThrow();
  });

  test("allows a plan when no installed item changes mode", () => {
    expect(() => assertIntegrationModeChangesAllowed([], "copy", false)).not.toThrow();
  });
});

describe("--all selection", () => {
  test("installs every public item and its hidden dependency closure without standalone add-ons", async () => {
    writeAddConfig(root);
    const program = createAddTestCli("dgadd-all-test");

    await program.parseAsync(["add", "--all", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });

    for (const name of publicAvailableNames()) {
      expect(readInstalledAs(root, name), name).toBe("explicit");
    }
    expect(readInstalledAs(root, "ui/portal")).toBe("transitive");
    expect(readInstalledAs(root, "ui/dialog-shell")).toBe("transitive");
    const installed = readInstalledComponents(root);
    expect(installed["ui/logo-figlet"]).toBeUndefined();
    expect(installed["ui/code-block-highlight"]).toBeUndefined();
  });

  test("installs hidden dependencies owned by an explicitly requested public item", async () => {
    writeAddConfig(root);
    const program = createAddTestCli("dgadd-explicit-dependency-test");

    await program.parseAsync(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });

    expect(readInstalledAs(root, "ui/dialog")).toBe("explicit");
    expect(readInstalledAs(root, "ui/portal")).toBe("transitive");
    expect(readInstalledAs(root, "ui/dialog-shell")).toBe("transitive");
  });
});

describe("add command transaction", () => {
  test("serializes concurrent stylesheet reconciliation so both CSS chunks survive", async () => {
    writeAddConfig(root);
    const lockPath = join(root, ".diffgazer", "add.lock");
    let releaseLock = () => {};
    let markLockAcquired = () => {};
    const lockAcquired = new Promise<void>((resolve) => {
      markLockAcquired = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const barrier = withFileLock(lockPath, async () => {
      markLockAcquired();
      await release;
    });
    await lockAcquired;

    const codeBlockProgram = createAddTestCli("dgadd-concurrent-code-block-test");
    const panelProgram = createAddTestCli("dgadd-concurrent-panel-test");
    const codeBlockAdd = codeBlockProgram.parseAsync(
      ["add", "ui/code-block", "--integration", "none", "--cwd", root, "--yes", "--skip-install"],
      { from: "user" },
    );
    const panelAdd = panelProgram.parseAsync(
      ["add", "ui/panel", "--integration", "none", "--cwd", root, "--yes", "--skip-install"],
      { from: "user" },
    );

    releaseLock();
    await barrier;
    await Promise.all([codeBlockAdd, panelAdd]);

    const stylesheet = readFileSync(join(root, "src/styles/styles.css"), "utf8");
    const codeBlockCss = ctx.items
      .getOrThrow("code-block")
      .files.find((file) => file.path.endsWith(".css"))
      ?.content.trimEnd();
    const panelCss = ctx.items
      .getOrThrow("panel")
      .files.find((file) => file.path.endsWith(".css"))
      ?.content.trimEnd();
    expect(codeBlockCss).toBeTruthy();
    expect(panelCss).toBeTruthy();
    expect(stylesheet).toContain(codeBlockCss);
    expect(stylesheet).toContain(panelCss);
    expect(existsSync(lockPath)).toBe(false);
  });

  test("rolls back a two-item install after finalization fails and retries without cleanup", async () => {
    const packagePath = join(root, "package.json");
    const manifestPath = join(root, "diffgazer.json");
    const seededSourcePath = join(root, "src/components/ui/accordion/accordion.tsx");
    const firstExplicitPath = seededSourcePath;
    const secondExplicitPath = join(root, "src/components/ui/toast/toast.tsx");
    const packageBytes = Buffer.from(
      `${JSON.stringify(
        {
          name: "fixture",
          type: "module",
          packageManager: "pnpm@10.0.0",
          dependencies: { existing: "^1.0.0" },
        },
        null,
        2,
      )}\n`,
    );
    const manifestBytes = Buffer.from(
      `${JSON.stringify(
        {
          aliases: {
            components: "@/components/ui",
            utils: "@/lib/utils",
            lib: "@/lib",
            hooks: "@/hooks",
          },
          componentsFsPath: "src/components/ui",
          libFsPath: "src/lib",
          hooksFsPath: "src/hooks",
          tailwind: { css: "src/styles/styles.css" },
          installedComponents: {
            "ui/existing": {
              installedAt: "2026-01-01T00:00:00.000Z",
              installedAs: "explicit",
              files: [],
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    writeFileSync(packagePath, packageBytes);
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
    );
    writeFileSync(manifestPath, manifestBytes);
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n/* original */\n');
    mkdirSync(join(root, "src/components/ui/accordion"), { recursive: true });
    writeFileSync(seededSourcePath, "// local accordion bytes\n");

    for (const [index, lockfile] of PACKAGE_MANAGER_LOCKFILES.entries()) {
      if (index % 2 === 0) writeFileSync(join(root, lockfile), `original ${lockfile}\n`);
    }

    const sourceSnapshot = snapshotSourceFiles(root);
    const manifestOwnershipSnapshot = readInstalledComponents(root);
    const lockfileSnapshot = snapshotLockfiles(root);
    const mutatedPackageBytes = Buffer.from(
      `${JSON.stringify({ dependencies: { "transaction-mutated": "1.0.0" } }, null, 2)}\n`,
    );
    fakeBin = mkdtempSync(join(tmpdir(), "dgadd-fake-pnpm-"));
    const fakePnpmPath = join(fakeBin, "pnpm");
    writeFileSync(
      fakePnpmPath,
      [
        "#!/usr/bin/env node",
        'const { writeFileSync } = require("node:fs");',
        `writeFileSync(${JSON.stringify(packagePath)}, ${JSON.stringify(mutatedPackageBytes.toString())});`,
        ...PACKAGE_MANAGER_LOCKFILES.map(
          (lockfile) =>
            `writeFileSync(${JSON.stringify(join(root, lockfile))}, ${JSON.stringify(`mutated ${lockfile}\n`)});`,
        ),
      ].join("\n"),
    );
    chmodSync(fakePnpmPath, 0o755);
    process.env.PATH = `${fakeBin}:${originalPath ?? ""}`;

    const writeConfigImpl = ctx.config.writeConfig;
    let stateAtFailure:
      | {
          firstItemWritten: boolean;
          secondItemWritten: boolean;
          firstItemOwned: boolean;
          secondItemOwned: boolean;
          packageMutated: boolean;
          lockfilesMutated: boolean;
        }
      | undefined;
    const writeConfig = vi
      .spyOn(ctx.config, "writeConfig")
      .mockImplementationOnce((cwd, config) => {
        writeConfigImpl(cwd, config);
        const ownership = readInstalledComponents(root);
        stateAtFailure = {
          firstItemWritten:
            existsSync(firstExplicitPath) &&
            readFileSync(firstExplicitPath, "utf-8") !== "// local accordion bytes\n",
          secondItemWritten: existsSync(secondExplicitPath),
          firstItemOwned: ownership["ui/accordion"] !== undefined,
          secondItemOwned: ownership["ui/toast"] !== undefined,
          packageMutated: readFileSync(packagePath).equals(mutatedPackageBytes),
          lockfilesMutated: PACKAGE_MANAGER_LOCKFILES.every(
            (lockfile) => readFileSync(join(root, lockfile), "utf-8") === `mutated ${lockfile}\n`,
          ),
        };
        throw new Error("forced two-item manifest finalization failure");
      });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const program = createAddTestCli("dgadd-transaction-test");
    const argv = [
      "add",
      "ui/accordion",
      "ui/toast",
      "--integration",
      "keys",
      "--overwrite",
      "--cwd",
      root,
      "--yes",
    ];

    await program.parseAsync(argv, { from: "user" });

    expect(exit).toHaveBeenCalledWith(1);
    expect(writeConfig).toHaveBeenCalledTimes(1);
    expect(stateAtFailure).toEqual({
      firstItemWritten: true,
      secondItemWritten: true,
      firstItemOwned: true,
      secondItemOwned: true,
      packageMutated: true,
      lockfilesMutated: true,
    });
    expect(snapshotSourceFiles(root)).toEqual(sourceSnapshot);
    expect(readFileSync(manifestPath)).toEqual(manifestBytes);
    expect(readInstalledComponents(root)).toEqual(manifestOwnershipSnapshot);
    expect(readInstalledComponents(root)["ui/accordion"]).toBeUndefined();
    expect(readInstalledComponents(root)["ui/toast"]).toBeUndefined();
    expect(readFileSync(packagePath)).toEqual(packageBytes);
    expect(snapshotLockfiles(root)).toEqual(lockfileSnapshot);
    expect(existsSync(join(root, ".diffgazer", "add.lock"))).toBe(false);

    exit.mockClear();
    await program.parseAsync(argv, { from: "user" });

    expect(exit).not.toHaveBeenCalled();
    expect(readInstalledComponents(root)["ui/accordion"]).toEqual(
      expect.objectContaining({ installedAs: "explicit" }),
    );
    expect(readInstalledComponents(root)["ui/toast"]).toEqual(
      expect.objectContaining({ installedAs: "explicit" }),
    );
    expect(snapshotSourceFiles(root)).not.toEqual(sourceSnapshot);
  });
});
