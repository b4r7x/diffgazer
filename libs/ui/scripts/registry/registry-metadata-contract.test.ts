import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, readPublicRegistryItems, readSourceRegistry } from "./registry-test-helpers";

describe("CSS-heavy components declare CSS in registry metadata", () => {
  const CSS_HEAVY_COMPONENTS = ["dialog", "command-palette"];

  it.each(
    CSS_HEAVY_COMPONENTS,
  )("%s depends on dialog-shell which declares component CSS", (componentName) => {
    const registry = readSourceRegistry();
    const item = registry.items?.find((i) => i.name === componentName);
    expect(item, `${componentName} must exist in registry`).toBeDefined();

    const deps = item?.registryDependencies ?? [];
    expect(deps).toContain("dialog-shell");

    const dialogShell = registry.items?.find((i) => i.name === "dialog-shell");
    expect(dialogShell).toBeDefined();

    const cssFile = dialogShell?.files?.find((f) => f.path.endsWith(".css"));
    expect(cssFile, "dialog-shell must include a CSS file").toBeDefined();
    expect(cssFile?.type).toBe("registry:style");
    expect(cssFile?.target).toMatch(/\.css$/);
  });

  it("dialog declares its copied scroll-lock hook dependency", () => {
    const registry = readSourceRegistry();
    const dialog = registry.items?.find((item) => item.name === "dialog");

    expect(dialog?.registryDependencies).toContain("@diffgazer-keys/scroll-lock");
  });
});

describe("public surface items are intentional", () => {
  const HIDDEN_ITEMS = ["diff", "input-variants", "search", "selectable-variants", "step-status"];

  it.each(HIDDEN_ITEMS)("%s is marked hidden in registry metadata", (itemName) => {
    const registry = readSourceRegistry();
    const item = registry.items?.find((i) => i.name === itemName);
    expect(item, `${itemName} must exist in registry`).toBeDefined();
    expect(item?.meta?.hidden).toBe(true);
  });

  it("hidden items are not exposed in package.json exports", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")) as {
      exports?: Record<string, unknown>;
    };
    const exports = pkg.exports ?? {};

    for (const name of HIDDEN_ITEMS) {
      expect(exports).not.toHaveProperty(`./lib/${name}`);
    }
  });

  const PUBLIC_LIB_ITEMS = ["selectable-collection", "compose-refs"];

  it.each(PUBLIC_LIB_ITEMS)("%s is public and has a package.json export", (itemName) => {
    const registry = readSourceRegistry();
    const item = registry.items?.find((i) => i.name === itemName);
    expect(item, `${itemName} must exist in registry`).toBeDefined();
    expect(item?.meta?.hidden).toBeFalsy();

    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")) as {
      exports?: Record<string, unknown>;
    };
    expect(pkg.exports).toHaveProperty(`./lib/${itemName}`);
  });
});

describe("stale dependency metadata removed", () => {
  it("overflow does not declare class-variance-authority as a dependency", () => {
    const registry = readSourceRegistry();
    const overflow = registry.items?.find((i) => i.name === "overflow");
    expect(overflow, "overflow must exist in registry").toBeDefined();
    expect(overflow?.dependencies ?? []).not.toContain("class-variance-authority");
  });

  it("overflow public registry item does not declare class-variance-authority", () => {
    const items = readPublicRegistryItems();
    const overflow = items.find((i) => i.name === "overflow");
    expect(overflow, "overflow must exist in public registry").toBeDefined();
    expect(overflow?.dependencies ?? []).not.toContain("class-variance-authority");
  });
});

describe("stepper CSS declared in source registry", () => {
  const STEPPER_COMPONENTS = ["stepper", "horizontal-stepper"];

  it.each(STEPPER_COMPONENTS)("%s declares stepper.css in its files array", (componentName) => {
    const registry = readSourceRegistry();
    const item = registry.items?.find((i) => i.name === componentName);
    expect(item, `${componentName} must exist in registry`).toBeDefined();

    const cssFile = item?.files?.find((f) => f.path.endsWith("stepper.css"));
    expect(cssFile, `${componentName} must include stepper.css`).toBeDefined();
    expect(cssFile?.type).toBe("registry:style");
    expect(cssFile?.target).toBe("~/styles/stepper.css");
  });
});
