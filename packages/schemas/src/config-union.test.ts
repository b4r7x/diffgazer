import { describe, it, expect } from "vitest";
import { ConfigCheckResponseSchema, type ConfigCheckResponse } from "./config.js";

describe("ConfigCheckResponseSchema discriminated union", () => {
  describe("valid states", () => {
    it("accepts configured: true with config", () => {
      const validConfigured = {
        configured: true as const,
        config: { provider: "gemini" as const },
      };
      const result = ConfigCheckResponseSchema.safeParse(validConfigured);
      expect(result.success).toBe(true);
    });

    it("accepts configured: true with config including optional model", () => {
      const validConfiguredWithModel = {
        configured: true as const,
        config: { provider: "gemini" as const, model: "gemini-2.5-flash" },
      };
      const result = ConfigCheckResponseSchema.safeParse(validConfiguredWithModel);
      expect(result.success).toBe(true);
    });

    it("accepts configured: false without config", () => {
      const validUnconfigured = { configured: false as const };
      const result = ConfigCheckResponseSchema.safeParse(validUnconfigured);
      expect(result.success).toBe(true);
    });
  });

  describe("invalid states - making illegal states unrepresentable", () => {
    it("rejects configured: true without config", () => {
      const invalidConfiguredNoConfig = { configured: true as const };
      const result = ConfigCheckResponseSchema.safeParse(invalidConfiguredNoConfig);
      expect(result.success).toBe(false);
    });
  });
});
