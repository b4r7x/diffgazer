import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx } from "../../context.js";
import { applyIntegrationDeps, resolveIntegrations } from "./integration.js";

// Force a non-interactive terminal so canPrompt() is false regardless of how
// vitest is launched: this exercises the real non-interactive integration-
// selection path through the production promptSelect call rather than a
// hand-supplied guidance stub, and never blocks on a real clack prompt.
describe("resolveIntegrations non-interactive selection", () => {
  const originalStdin = process.stdin.isTTY;
  const originalStdout = process.stdout.isTTY;

  beforeEach(() => {
    process.stdin.isTTY = false;
    process.stdout.isTTY = false;
  });

  afterEach(() => {
    process.stdin.isTTY = originalStdin;
    process.stdout.isTTY = originalStdout;
  });

  test("fails with the actionable --integration flag when a selection is required", async () => {
    await expect(resolveIntegrations(["select"], "ask", false)).rejects.toThrow(
      "--integration copy|keys|none",
    );
  });

  test("resolves without prompting when the mode is given explicitly", async () => {
    await expect(resolveIntegrations(["select"], "copy", false)).resolves.toEqual({ mode: "copy" });
  });

  test("accepts the base floating panel without its custom-menu integrations", async () => {
    const sourceRegistry = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "../../../../../libs/ui/registry/registry.json"),
        "utf8",
      ),
    ) as {
      items: Array<{
        name: string;
        registryDependencies?: string[];
        meta?: Record<string, unknown>;
        files: Array<Record<string, unknown>>;
      }>;
    };
    const floatingPanel = sourceRegistry.items.find((item) => item.name === "floating-panel");
    expect(floatingPanel).toBeDefined();
    expect(floatingPanel?.registryDependencies).not.toEqual(
      expect.arrayContaining(["outside-click", "@diffgazer-keys/focusable"]),
    );
    expect(floatingPanel?.meta?.optionalIntegrations).toBeUndefined();

    const originalGetItem = ctx.registry.getItem.bind(ctx.registry);
    const getItem = vi.spyOn(ctx.registry, "getItem").mockImplementation((name) => {
      if (name === "floating-panel" && floatingPanel) {
        return floatingPanel as ReturnType<typeof ctx.registry.getItem>;
      }
      return originalGetItem(name);
    });
    try {
      await expect(resolveIntegrations(["floating-panel"], "none", false)).resolves.toEqual({
        mode: "none",
      });
    } finally {
      getItem.mockRestore();
    }
  });
});

describe("applyIntegrationDeps", () => {
  test("removes unversioned and versioned keys dependencies in copy mode", () => {
    expect(
      applyIntegrationDeps(
        ["@diffgazer/keys", "@diffgazer/keys@^0.2.0", "clsx"],
        { mode: "copy" },
        "^0.3.0",
      ),
    ).toEqual(["clsx"]);
  });

  test("normalizes keys dependencies to the requested package version", () => {
    expect(
      applyIntegrationDeps(
        ["@diffgazer/keys", "@diffgazer/keys@^0.2.0", "clsx"],
        { mode: "@diffgazer/keys" },
        "^0.3.0",
      ),
    ).toEqual(["clsx", "@diffgazer/keys@^0.3.0"]);
  });
});
