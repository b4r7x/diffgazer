import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeIntegrity } from "@diffgazer/registry";
import { describe, expect, test, vi } from "vitest";
import { ctx } from "../../context.js";
import {
  applyIntegrationModeMigration,
  assertIntegrationModeChangesAllowed,
  planIntegrationModeMigration,
} from "./integration-mode.js";

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

  test("fails closed when a retained copy-mode item cannot be resolved in the bundled registry", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dgadd-integration-mode-"));
    try {
      mkdirSync(join(cwd, "src/hooks"), { recursive: true });
      writeFileSync(
        join(cwd, "diffgazer.json"),
        `${JSON.stringify(
          {
            aliases: {
              components: "@/components/ui",
              utils: "@/lib/utils",
              lib: "@/lib",
              hooks: "@/hooks",
            },
            componentsFsPath: "src/components/ui",
            hooksFsPath: "src/hooks",
            libFsPath: "src/lib",
            tailwind: { css: "src/styles/styles.css" },
            installedItems: {
              "ui/legacy": {
                installedAt: "2026-01-01T00:00:00.000Z",
                installedAs: "explicit",
                integrationMode: "copy",
              },
              "ui/select": {
                installedAt: "2026-01-01T00:00:00.000Z",
                installedAs: "explicit",
                integrationMode: "copy",
              },
              "keys/navigation": {
                installedAt: "2026-01-01T00:00:00.000Z",
                installedAs: "transitive",
              },
            },
          },
          null,
          2,
        )}\n`,
      );

      const originalGetItem = ctx.registry.getItem.bind(ctx.registry);
      const getItem = vi.spyOn(ctx.registry, "getItem").mockImplementation((name) => {
        if (name === "legacy") return undefined;
        return originalGetItem(name);
      });

      const config = ctx.items.requireConfig(cwd);
      expect(() =>
        planIntegrationModeMigration(cwd, config, ["select"], "@diffgazer/keys", new Set()),
      ).toThrow(/missing from the bundled registry.*ui\/legacy/);

      getItem.mockRestore();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("restores earlier copied hook removals when a later file changed during application", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dgadd-integration-apply-"));
    try {
      const hooksPath = join(cwd, "src/hooks");
      mkdirSync(hooksPath, { recursive: true });
      const firstHook = join(hooksPath, "first.ts");
      const secondHook = join(hooksPath, "second.ts");
      const firstContent = "export const first = 1;\n";
      const secondContent = "export const second = 1;\n";
      writeFileSync(firstHook, firstContent);
      writeFileSync(secondHook, secondContent);

      const plan = {
        changedNames: ["ui/select"],
        removeManifestNames: ["keys/first", "keys/second"],
        filesToRemove: [
          {
            path: firstHook,
            content: firstContent,
            expectedHash: computeIntegrity(firstContent),
          },
          {
            path: secondHook,
            content: secondContent,
            expectedHash: computeIntegrity(secondContent),
          },
        ],
        hooksPath,
        manifestPath: join(cwd, "diffgazer.json"),
        manifestSnapshot: "{}",
      };

      writeFileSync(secondHook, "export const second = 2;\n");

      expect(() => applyIntegrationModeMigration(plan)).toThrow(
        /changed during integration migration/,
      );
      expect(existsSync(firstHook)).toBe(true);
      expect(readFileSync(firstHook, "utf-8")).toBe(firstContent);
      expect(readFileSync(secondHook, "utf-8")).toBe("export const second = 2;\n");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
