import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");

interface RegistryFile {
  path: string;
  type?: string;
  target?: string;
}

interface RegistryItem {
  name: string;
  files?: RegistryFile[];
}

interface Registry {
  items?: RegistryItem[];
}

function readRegistry(): Registry {
  return JSON.parse(readFileSync(resolve(ROOT, "registry/registry.json"), "utf-8")) as Registry;
}

describe("dialog-shell registry CSS wiring", () => {
  it("declares dialog.css as registry:style with a target so direct shadcn install copies it", () => {
    const registry = readRegistry();
    const dialogShell = registry.items?.find((item) => item.name === "dialog-shell");
    expect(dialogShell, "dialog-shell registry item must exist").toBeDefined();

    const cssFile = dialogShell?.files?.find((file) => file.path.endsWith("dialog.css"));
    expect(cssFile, "dialog.css must be listed in dialog-shell.files").toBeDefined();
    expect(cssFile?.type).toBe("registry:style");
    expect(cssFile?.target).toMatch(/\.css$/);
  });
});
