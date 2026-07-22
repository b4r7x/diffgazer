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
import { createCli } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx } from "../context.js";
import { addCommand } from "./add/command.js";
import { diffCommand } from "./diff.js";
import { removeCommand } from "./remove.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-ownership-reconciliation-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
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
