import { describe, expect, it } from "vitest";
import { z } from "zod";
import "./client-runtime";

describe("configureDocsClientRuntime", () => {
  it("configures the runtime when the module loads", () => {
    expect(z.config().jitless).toBe(true);
  });
});
