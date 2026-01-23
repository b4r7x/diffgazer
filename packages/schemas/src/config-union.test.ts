import { describe, it, expect } from "vitest";
import { ConfigCheckResponseSchema } from "./config.js";

describe("ConfigCheckResponseSchema discriminated union", () => {
  describe("valid states", () => {
    it("accepts configured: true with config", () => {
      const result = ConfigCheckResponseSchema.safeParse({
        configured: true,
        config: { provider: "gemini", model: "gemini-2.5-flash" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts configured: false without config", () => {
      const result = ConfigCheckResponseSchema.safeParse({ configured: false });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid states", () => {
    it("rejects configured: true without config", () => {
      const result = ConfigCheckResponseSchema.safeParse({ configured: true });
      expect(result.success).toBe(false);
    });
  });
});
