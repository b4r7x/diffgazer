import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateThemeStyles } from "@diffgazer/registry";
import { describe, expect, it } from "vitest";
import type { Registry } from "./registry/types.js";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

function readRegistry(): Registry {
  return JSON.parse(readFileSync(resolve(ROOT, "registry/registry.json"), "utf-8")) as Registry;
}

describe("dialog-shell registry CSS wiring", () => {
  it("keeps authored dialog.css as a targeted copy/package style payload", () => {
    const registry = readRegistry();
    const dialogShell = registry.items?.find((item) => item.name === "dialog-shell");
    expect(dialogShell, "dialog-shell registry item must exist").toBeDefined();

    const cssFile = dialogShell?.files?.find((file) => file.path.endsWith("dialog.css"));
    expect(cssFile, "dialog.css must be listed in dialog-shell.files").toBeDefined();
    expect(cssFile?.type).toBe("registry:style");
    expect(cssFile?.target).toBe("~/styles/dialog.css");
  });

  it("proves every shadcn-stripped CSS item is covered by a theme dependency closure", () => {
    const registry = readRegistry();
    const items = registry.items ?? [];
    const itemByName = new Map(items.map((item) => [item.name, item]));
    const roots = items.filter((item) => item.meta?.hidden !== true);
    const aggregate = aggregateThemeStyles({
      rootDir: ROOT,
      sourceRegistryPath: "registry/registry.json",
      seedContent: readFileSync(resolve(ROOT, "styles/styles.css"), "utf-8"),
    });

    function closure(startName: string): Set<string> {
      const seen = new Set<string>();
      const pending = [startName];
      while (pending.length > 0) {
        const name = pending.pop();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        for (const dependency of itemByName.get(name)?.registryDependencies ?? []) {
          if (itemByName.has(dependency)) pending.push(dependency);
        }
      }
      return seen;
    }

    for (const item of items.filter(
      (candidate) =>
        candidate.name !== "theme" &&
        candidate.files?.some((file) => file.type === "registry:style"),
    )) {
      const carriers = roots.filter((root) => closure(root.name).has(item.name));
      expect(carriers, `${item.name} must be reachable from an installable root`).not.toHaveLength(
        0,
      );
      expect(
        carriers.every((root) => closure(root.name).has("theme")),
        `${item.name} must be covered by theme in every installable closure`,
      ).toBe(true);

      for (const file of item.files?.filter((candidate) => candidate.type === "registry:style") ??
        []) {
        expect(
          aggregate,
          `${file.path} must be byte-for-byte present in the aggregate theme`,
        ).toContain(readFileSync(resolve(ROOT, file.path), "utf-8"));
      }
    }
  });
});
