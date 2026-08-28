import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx, VERSION } from "../../context.js";
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
    installedItems: {
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

  test("carries installedItems across a forced re-init so remove/diff still see ownership", () => {
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

  test("refuses --force on a parse-invalid config unless --reset-manifest is also passed", () => {
    seedInstalledProject(true);
    writeFileSync(join(root, "diffgazer.json"), "{ not valid json\n");

    expect(() =>
      detectInitProject(root, { componentsDir: "src/components/ui", force: true }),
    ).toThrow(/--reset-manifest/);
    expect(() =>
      writeInitConfig(root, { componentsDir: "src/components/ui", force: true }),
    ).toThrow(/--reset-manifest/);
    expect(readFileSync(join(root, "diffgazer.json"), "utf8")).toBe("{ not valid json\n");
  });

  test("allows --force with --reset-manifest on a parse-invalid config to drop the ledger", () => {
    seedInstalledProject(true);
    writeFileSync(join(root, "diffgazer.json"), "{ not valid json\n");

    writeInitConfig(root, {
      componentsDir: "src/components/ui",
      force: true,
      resetManifest: true,
    });

    expect(ctx.config.getManifestItems(root)).toBeUndefined();
    const rewritten = ctx.config.loadConfig(root);
    if (!rewritten.ok) throw new Error("expected rewritten config to load");
    expect(rewritten.config.version).toBe(VERSION);
  });

  test("recovers installedItems across --force when validation fails but JSON is parseable", () => {
    seedInstalledProject(true);
    writeFileSync(
      join(root, "diffgazer.json"),
      `${JSON.stringify({ ...priorConfig, aliases: { components: 42 } }, null, 2)}\n`,
    );

    writeInitConfig(root, { componentsDir: "src/components/ui", force: true });

    const manifest = ctx.config.getManifestItems(root);
    expect(manifest?.["ui/button"]?.files?.[0]?.hash).toBe("deadbeefcafef00d");
  });

  test("init --force succeeds when validation fails on aliases but topology is unchanged", async () => {
    seedInstalledProject(true);
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "fixture",
          type: "module",
          devDependencies: { tailwindcss: "^4.1.0" },
        },
        null,
        2,
      )}\n`,
    );
    const invalidConfig = { ...priorConfig, aliases: { components: 42 } };
    writeFileSync(join(root, "diffgazer.json"), `${JSON.stringify(invalidConfig, null, 2)}\n`);
    const before = readFileSync(join(root, "diffgazer.json"), "utf-8");

    await initCommand.parseAsync([
      "node",
      "dgadd",
      "--cwd",
      root,
      "--yes",
      "--force",
      "--skip-install",
    ]);

    const manifest = ctx.config.getManifestItems(root);
    expect(manifest?.["ui/button"]?.files?.[0]?.hash).toBe("deadbeefcafef00d");
    const rewritten = ctx.config.loadConfig(root);
    if (!rewritten.ok) throw new Error("expected rewritten config to load");
    expect(rewritten.config.aliases?.components).toBe("@/components/ui");
    expect(readFileSync(join(root, "diffgazer.json"), "utf-8")).not.toBe(before);
  });

  test("init --force rejects topology changes when validation fails on aliases", async () => {
    seedInstalledProject(true);
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "fixture",
          type: "module",
          devDependencies: { tailwindcss: "^4.1.0" },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(root, "diffgazer.json"),
      `${JSON.stringify({ ...priorConfig, aliases: { components: 42 } }, null, 2)}\n`,
    );
    const before = readFileSync(join(root, "diffgazer.json"), "utf-8");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit:${String(code)}`);
    });

    await expect(
      initCommand.parseAsync([
        "node",
        "dgadd",
        "--cwd",
        root,
        "--yes",
        "--force",
        "--skip-install",
        "--components-dir",
        "src/components/next",
      ]),
    ).rejects.toThrow(/process.exit:1/);

    exitSpy.mockRestore();
    expect(readFileSync(join(root, "diffgazer.json"), "utf-8")).toBe(before);
  });

  test("refuses --force when validation fails and the ledger itself is invalid", () => {
    seedInstalledProject(true);
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "fixture",
          type: "module",
          devDependencies: { tailwindcss: "^4.1.0" },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(root, "diffgazer.json"),
      `${JSON.stringify(
        {
          ...priorConfig,
          aliases: { components: 42 },
          installedItems: {
            "ui/button": {
              installedAt: "2026-01-01T00:00:00.000Z",
              cssChunks: ["not-a-valid-hash"],
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    expect(() =>
      detectInitProject(root, { componentsDir: "src/components/ui", force: true }),
    ).toThrow(/invalid installedItems ledger/);
    expect(() =>
      writeInitConfig(root, { componentsDir: "src/components/ui", force: true }),
    ).toThrow(/invalid installedItems ledger/);
  });
});
