import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeIntegrity } from "@diffgazer/registry";
import { createCli, PACKAGE_MANAGER_LOCKFILES, runInitWorkflow } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx, DiffgazerAddConfigSchema, VERSION } from "../context.js";
import { buildExpectedChunkContentsForItem } from "../utils/css-chunks.js";
import { addCommand } from "./add/command.js";
import { diffCommand } from "./diff.js";
import { buildInitPlannedPaths, detectInitProject, initCommand, writeInitConfig } from "./init.js";
import { removeCommand } from "./remove.js";

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
    const option = initCommand.options.find(({ long }) => long === "--reset-manifest");

    expect(option?.description).toContain("Recovery only");
    expect(option?.description).toContain("ownership ledger");
    expect(option?.description).toContain("orphaning previously installed files");
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

describe("dgadd config CSS chunk hashes", () => {
  test.each([
    "../../outside",
    "ABCDEF0123456789",
    "abcdef012345678",
    "abcdef01234567890",
  ])("rejects non-canonical hash %s", (hash) => {
    const result = DiffgazerAddConfigSchema.safeParse({
      installedComponents: {
        "ui/dialog": { installedAt: "2026-07-15T00:00:00.000Z", cssChunks: [hash] },
      },
    });

    expect(result.success).toBe(false);
  });

  test("accepts exactly sixteen lowercase hexadecimal characters", () => {
    const result = DiffgazerAddConfigSchema.safeParse({
      installedComponents: {
        "ui/dialog": {
          installedAt: "2026-07-15T00:00:00.000Z",
          cssChunks: ["abcdef0123456789"],
        },
      },
    });

    expect(result.success).toBe(true);
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

describe("dgadd overwrite ownership reconciliation", () => {
  test("reconciles v1 ownership through rollback, diff, remove, and reinstall", async () => {
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify({ name: "fixture", type: "module" }, null, 2)}\n`,
    );
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    );
    writeFileSync(
      join(root, "diffgazer.json"),
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
        },
        null,
        2,
      )}\n`,
    );
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), "");

    const program = createCli({
      name: "dgadd-reconciliation-test",
      displayName: "DIFFGAZER RECONCILIATION TEST",
      description: "real command reconciliation test",
      version: "0.0.0",
      commands: [addCommand, diffCommand, removeCommand],
    });
    const addArgs = [
      "add",
      "ui/accordion",
      "--integration",
      "keys",
      "--overwrite",
      "--skip-install",
      "--cwd",
      root,
      "--yes",
    ];
    await program.parseAsync(addArgs, { from: "user" });

    const cleanPath = join(root, "src/components/ui/accordion/retired-clean.ts");
    const renamedPath = join(root, "src/components/ui/accordion/accordion-v1.tsx");
    const modifiedPath = join(root, "src/components/ui/accordion/retired-modified.ts");
    const sharedPath = join(root, "src/components/ui/shared-v1.ts");
    mkdirSync(join(root, "src/components/ui/accordion"), { recursive: true });
    writeFileSync(cleanPath, "export const retiredClean = true;\n");
    writeFileSync(modifiedPath, "export const localEdit = true;\n");
    writeFileSync(sharedPath, "export const sharedV1 = true;\n");

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")) as {
      installedComponents: Record<
        string,
        {
          installedAt: string;
          installedAs?: "explicit" | "transitive";
          files?: Array<{ path: string; hash: string; item: string }>;
        }
      >;
    };
    const accordion = config.installedComponents["ui/accordion"];
    if (!accordion) throw new Error("Expected the initial real add to install ui/accordion");
    const renamedSource = accordion.files?.find(
      (file) => file.path.endsWith("/accordion.tsx") && existsSync(join(root, file.path)),
    );
    if (!renamedSource) throw new Error("Expected ui/accordion to own accordion.tsx");
    const currentAccordionPath = join(root, renamedSource.path);
    renameSync(currentAccordionPath, renamedPath);
    accordion.files = [
      ...(accordion.files ?? []).filter((file) => file !== renamedSource),
      {
        ...renamedSource,
        path: "src/components/ui/accordion/accordion-v1.tsx",
      },
      {
        path: "src/components/ui/accordion/retired-clean.ts",
        hash: computeIntegrity("export const retiredClean = true;\n"),
        item: "ui/accordion",
      },
      {
        path: "src/components/ui/accordion/retired-modified.ts",
        hash: computeIntegrity("export const registryOriginal = true;\n"),
        item: "ui/accordion",
      },
      {
        path: "src/components/ui/shared-v1.ts",
        hash: computeIntegrity("export const sharedV1 = true;\n"),
        item: "ui/accordion",
      },
    ];
    config.installedComponents["ui/toast"] = {
      installedAt: "2026-01-01T00:00:00.000Z",
      installedAs: "explicit",
      files: [
        {
          path: "src/components/ui/shared-v1.ts",
          hash: computeIntegrity("export const sharedV1 = true;\n"),
          item: "ui/toast",
        },
      ],
    };
    writeFileSync(join(root, "diffgazer.json"), `${JSON.stringify(config, null, 2)}\n`);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const manifestBeforeFailure = readFileSync(join(root, "diffgazer.json"));
      const writeConfigImpl = ctx.config.writeConfig;
      const writeConfig = vi.spyOn(ctx.config, "writeConfig").mockImplementation((cwd, next) => {
        writeConfigImpl(cwd, next);
        throw new Error("forced overwrite finalization failure");
      });
      const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

      await program.parseAsync(addArgs, { from: "user" });

      expect(exit).toHaveBeenCalledWith(1);
      expect(readFileSync(join(root, "diffgazer.json"))).toEqual(manifestBeforeFailure);
      expect(existsSync(cleanPath)).toBe(true);
      expect(existsSync(renamedPath)).toBe(true);
      expect(existsSync(currentAccordionPath)).toBe(false);
      expect(existsSync(modifiedPath)).toBe(true);
      expect(existsSync(sharedPath)).toBe(true);
      writeConfig.mockRestore();
      exit.mockRestore();

      await program.parseAsync(addArgs, { from: "user" });

      expect(existsSync(cleanPath)).toBe(false);
      expect(existsSync(renamedPath)).toBe(false);
      expect(existsSync(currentAccordionPath)).toBe(true);
      expect(existsSync(modifiedPath)).toBe(true);
      expect(existsSync(sharedPath)).toBe(true);
      const reconciled = ctx.config.getManifestItems(root) ?? {};
      expect(reconciled["ui/accordion"]?.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "src/components/ui/accordion/retired-modified.ts",
            retired: true,
          }),
        ]),
      );
      expect(
        reconciled["ui/accordion"]?.files?.some(
          (file) => file.path === "src/components/ui/shared-v1.ts",
        ),
      ).toBe(false);
      expect(
        reconciled["ui/toast"]?.files?.some(
          (file) => file.path === "src/components/ui/shared-v1.ts",
        ),
      ).toBe(true);
      expect(log.mock.calls.flat().join("\n")).toContain("remains tracked as retired drift");

      log.mockClear();
      await program.parseAsync(["diff", "ui/accordion", "--cwd", root], { from: "user" });
      const diffOutput = log.mock.calls.flat().join("\n");
      expect(diffOutput).toContain("retired-modified.ts~retired");
      expect(diffOutput).toContain("1 changed");

      log.mockClear();
      await program.parseAsync(["remove", "ui/accordion", "--cwd", root, "--yes"], {
        from: "user",
      });
      expect(existsSync(modifiedPath)).toBe(true);
      expect(ctx.config.getManifestItems(root)?.["ui/accordion"]).toBeDefined();
      expect(log.mock.calls.flat().join("\n")).toContain("has been modified");

      await program.parseAsync(["remove", "ui/accordion", "--cwd", root, "--yes", "--force"], {
        from: "user",
      });
      expect(existsSync(modifiedPath)).toBe(false);
      expect(existsSync(sharedPath)).toBe(true);
      expect(ctx.config.getManifestItems(root)?.["ui/accordion"]).toBeUndefined();
      expect(ctx.config.getManifestItems(root)?.["ui/toast"]).toBeDefined();

      await program.parseAsync(addArgs, { from: "user" });
      expect(ctx.config.getManifestItems(root)?.["ui/accordion"]).toBeDefined();
      expect(existsSync(currentAccordionPath)).toBe(true);
      expect(existsSync(modifiedPath)).toBe(false);
      expect(existsSync(sharedPath)).toBe(true);

      log.mockClear();
      await program.parseAsync(["diff", "ui/accordion", "--cwd", root], { from: "user" });
      const reinstallDiff = log.mock.calls.flat().join("\n");
      expect(reinstallDiff).toContain("up to date");
      expect(reinstallDiff).not.toContain("~retired");
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("dgadd CSS chunk upgrade reconciliation", () => {
  const oldChunkBody = 'dialog[data-state="open"] { --legacy-dialog: 1; }';
  const oldChunkHash = createHash("sha256").update(oldChunkBody).digest("hex").slice(0, 16);

  function seedCssUpgradeProject(body = oldChunkBody): string {
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify({ name: "fixture", type: "module" }, null, 2)}\n`,
    );
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    );
    writeFileSync(
      join(root, "diffgazer.json"),
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
            "ui/dialog-shell": {
              installedAt: "2026-01-01T00:00:00.000Z",
              installedAs: "transitive",
              cssChunks: [oldChunkHash],
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    mkdirSync(join(root, "src/styles"), { recursive: true });
    const stylesPath = join(root, "src/styles/styles.css");
    writeFileSync(
      stylesPath,
      `/* base */\n\n/* dgadd:css ${oldChunkHash} */\n${body}\n/* dgadd:css-end ${oldChunkHash} */\n`,
    );
    return stylesPath;
  }

  function createCssUpgradeCli() {
    return createCli({
      name: "dgadd-css-upgrade-test",
      displayName: "DIFFGAZER CSS UPGRADE TEST",
      description: "CSS upgrade reconciliation test",
      version: "0.0.0",
      commands: [addCommand, diffCommand],
    });
  }

  const addArgs = [
    "add",
    "ui/dialog",
    "--integration",
    "keys",
    "--overwrite",
    "--skip-install",
    "--yes",
  ];

  test("replaces a pristine obsolete marker and records only the current hash", async () => {
    const stylesPath = seedCssUpgradeProject();
    const program = createCssUpgradeCli();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync([...addArgs, "--cwd", root], { from: "user" });

    const [currentHash] = [...buildExpectedChunkContentsForItem("dialog-shell").keys()];
    if (!currentHash) throw new Error("Expected dialog-shell to ship a CSS chunk");
    const styles = readFileSync(stylesPath, "utf-8");
    expect(styles).not.toContain(`dgadd:css ${oldChunkHash}`);
    expect(styles.match(new RegExp(`dgadd:css ${currentHash}`, "g"))).toHaveLength(1);
    expect(ctx.config.getManifestItems(root)?.["ui/dialog-shell"]?.cssChunks).toEqual([
      currentHash,
    ]);

    log.mockClear();
    await program.parseAsync(["diff", "--cwd", root], { from: "user" });
    expect(log.mock.calls.flat().join("\n")).toContain("up to date");
  });

  test("preserves and tracks a modified obsolete marker while adding the current hash", async () => {
    const stylesPath = seedCssUpgradeProject(`${oldChunkBody}\n/* local edit */`);
    const program = createCssUpgradeCli();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync([...addArgs, "--cwd", root], { from: "user" });

    const [currentHash] = [...buildExpectedChunkContentsForItem("dialog-shell").keys()];
    if (!currentHash) throw new Error("Expected dialog-shell to ship a CSS chunk");
    const styles = readFileSync(stylesPath, "utf-8");
    expect(styles).toContain(`dgadd:css ${oldChunkHash}`);
    expect(styles).toContain("/* local edit */");
    expect(styles.match(new RegExp(`dgadd:css ${currentHash}`, "g"))).toHaveLength(1);
    expect(ctx.config.getManifestItems(root)?.["ui/dialog-shell"]?.cssChunks).toEqual([
      currentHash,
      oldChunkHash,
    ]);
    expect(warning.mock.calls.flat().join("\n")).toContain("Preserving obsolete CSS chunk");

    log.mockClear();
    await program.parseAsync(["diff", "--cwd", root], { from: "user" });
    const diffOutput = log.mock.calls.flat().join("\n");
    expect(diffOutput).toContain(`styles.css~chunk-${oldChunkHash}`);
    expect(diffOutput).toContain("changed");
  });
});
