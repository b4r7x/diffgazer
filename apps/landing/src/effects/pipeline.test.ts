// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { initPipeline } from "./pipeline";

describe("initPipeline", () => {
  it("returns an idempotent cleanup that detaches the parent abort listener without markup", () => {
    const parent = new AbortController();
    const removeEventListener = vi.spyOn(parent.signal, "removeEventListener");
    const cleanup = initPipeline(document.createElement("div"), undefined, parent.signal);

    cleanup();
    cleanup();

    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledWith("abort", cleanup);

    parent.abort();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });
});
