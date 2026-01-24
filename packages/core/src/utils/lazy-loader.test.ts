import { describe, expect, it, vi } from "vitest";
import { createLazyLoader } from "./lazy-loader.js";

describe("createLazyLoader", () => {
  it("returns loaded module on successful load", async () => {
    const mockModule = { name: "test-module", version: "1.0.0" };
    const loader = createLazyLoader(async () => mockModule);

    const result = await loader();

    expect(result).toEqual({
      module: mockModule,
      error: null,
      attempted: true,
    });
  });

  it("returns error on failed module load", async () => {
    const loader = createLazyLoader(async () => {
      throw new Error("Module not found");
    });

    const result = await loader();

    expect(result).toEqual({
      module: null,
      error: "Module not found",
      attempted: true,
    });
  });

  it("caches successful load result on multiple calls", async () => {
    const loaderFn = vi.fn(async () => ({ value: 42 }));
    const loader = createLazyLoader(loaderFn);

    const first = await loader();
    const second = await loader();
    const third = await loader();

    expect(loaderFn).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first.module).toEqual({ value: 42 });
  });

  it("caches error result on multiple calls", async () => {
    const loaderFn = vi.fn(async () => {
      throw new Error("Load failed");
    });
    const loader = createLazyLoader(loaderFn);

    const first = await loader();
    const second = await loader();
    const third = await loader();

    expect(loaderFn).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first.error).toBe("Load failed");
  });

  it("extracts error message from Error objects", async () => {
    const loader = createLazyLoader(async () => {
      throw new Error("Custom error message");
    });

    const result = await loader();

    expect(result.error).toBe("Custom error message");
  });

  it("extracts error message from non-Error objects", async () => {
    const loader = createLazyLoader(async () => {
      throw "String error";
    });

    const result = await loader();

    expect(result.error).toBe("String error");
  });

  it("handles rejected promises", async () => {
    const loader = createLazyLoader(() => Promise.reject(new Error("Promise rejected")));

    const result = await loader();

    expect(result).toEqual({
      module: null,
      error: "Promise rejected",
      attempted: true,
    });
  });

  it("maintains state across calls even after error", async () => {
    const loader = createLazyLoader(async () => {
      throw new Error("Failed");
    });

    const firstCall = await loader();
    expect(firstCall.attempted).toBe(true);
    expect(firstCall.module).toBe(null);
    expect(firstCall.error).toBe("Failed");

    const secondCall = await loader();
    expect(secondCall.attempted).toBe(true);
    expect(secondCall.module).toBe(null);
    expect(secondCall.error).toBe("Failed");
  });

  it("preserves module type information", async () => {
    interface CustomModule {
      initialize: () => void;
      data: string[];
    }

    const mockModule: CustomModule = {
      initialize: () => {},
      data: ["a", "b", "c"],
    };

    const loader = createLazyLoader<CustomModule>(async () => mockModule);
    const result = await loader();

    expect(result.module).toBe(mockModule);
    if (result.module) {
      expect(result.module.data).toEqual(["a", "b", "c"]);
    }
  });
});
