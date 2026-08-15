import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadLibraryHooksData } from "./load-hooks-data";

describe("loadLibraryHooksData", () => {
  it("loads and validates keys hook source on demand", async () => {
    const hooks = await loadLibraryHooksData("keys");

    expect(hooks["use-navigation"]?.title).toBe("useNavigation");
    expect(hooks["use-navigation"]?.source.raw).toContain("export function useNavigation");
  });

  it("returns an empty map for unknown libraries", async () => {
    await expect(loadLibraryHooksData("missing")).resolves.toEqual({});
  });
});

describe("generated doc data bundle boundary", () => {
  it("keeps hook aggregates out of the shared generated-doc-data module", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./generated-doc-data.ts"), "utf8");

    expect(source).not.toContain("@/generated/library-data");
    expect(source).not.toContain("hooksData");
  });
});

describe("rejected hook data requests", () => {
  afterEach(() => {
    vi.doUnmock("@/generated/ui/ui-hooks.json");
    vi.resetModules();
  });

  it("evicts a rejected generated-data loader so a later request can retry", async () => {
    vi.resetModules();
    const failure = new Error("hook bundle unavailable");
    vi.doMock("@/generated/ui/ui-hooks.json", () => ({ default: Promise.reject(failure) }));

    const { loadLibraryHooksData } = await import("./load-hooks-data");
    const firstRequest = loadLibraryHooksData("ui");
    await expect(firstRequest).rejects.toBe(failure);

    const secondRequest = loadLibraryHooksData("ui");
    await expect(secondRequest).rejects.toBe(failure);
    expect(secondRequest).not.toBe(firstRequest);
  });

  it("evicts a rejected schema validation so a later request can retry", async () => {
    vi.resetModules();
    vi.doMock("@/generated/ui/ui-hooks.json", () => ({
      default: { malformed: { name: 42 } },
    }));

    const { loadLibraryHooksData } = await import("./load-hooks-data");
    const firstRequest = loadLibraryHooksData("ui");
    await expect(firstRequest).rejects.toThrow("Invalid generated docs data: hooksData.ui");

    const secondRequest = loadLibraryHooksData("ui");
    await expect(secondRequest).rejects.toThrow("Invalid generated docs data: hooksData.ui");
    expect(secondRequest).not.toBe(firstRequest);
  });
});
