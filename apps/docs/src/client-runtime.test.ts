import { describe, expect, it } from "vitest";
import { z } from "zod";
import { configureDocsClientRuntime } from "./client-runtime";

describe("configureDocsClientRuntime", () => {
  it("configures the runtime when the module loads", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("disables Zod JIT compilation for the nonce CSP", () => {
    const previous = z.config().jitless;
    try {
      z.config({ jitless: false });
      configureDocsClientRuntime();
      expect(z.config().jitless).toBe(true);
    } finally {
      z.config({ jitless: previous });
    }
  });
});
