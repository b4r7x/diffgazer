import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import "./client-runtime";

describe("configureDocsClientRuntime", () => {
  it("configures the runtime when the module loads", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("is imported by the client entry before anything that can parse a schema", () => {
    // Asserted on the source rather than by importing client.tsx, which hydrates.
    // The import is side-effect-only, so nothing else would fail if it were dropped
    // and zod's Function-constructor JIT would return under a CSP that forbids eval.
    const clientEntry = readFileSync(resolve(import.meta.dirname, "client.tsx"), "utf-8");

    expect(clientEntry.split(/\r?\n/)[0]).toBe('import "./client-runtime";');
  });
});
