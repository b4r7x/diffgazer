import { describe, it, expect } from "vitest";
import {
  GEMINI_MODELS,
  GeminiModelSchema,
  AIProviderSchema,
  ModelInfoSchema,
  ProviderInfoSchema,
  UserConfigSchema,
  SaveConfigRequestSchema,
  ConfigErrorCodeSchema,
  ConfigErrorSchema,
  ConfigCheckResponseSchema,
  CurrentConfigResponseSchema,
  DeleteConfigResponseSchema,
  type GeminiModel,
} from "./config.js";

describe("AIProviderSchema", () => {
  it.each(["openai", "anthropic", "invalid", ""])(
    "rejects invalid provider: %s",
    (provider) => {
      const result = AIProviderSchema.safeParse(provider);
      expect(result.success).toBe(false);
    }
  );
});

describe("GeminiModelSchema", () => {
  it.each(GEMINI_MODELS as unknown as GeminiModel[])(
    "accepts valid model: %s",
    (model) => {
      const result = GeminiModelSchema.safeParse(model);
      expect(result.success).toBe(true);
    }
  );

  it.each(["gpt-4", "claude-3", "invalid-model", ""])(
    "rejects invalid model: %s",
    (model) => {
      const result = GeminiModelSchema.safeParse(model);
      expect(result.success).toBe(false);
    }
  );
});

describe("ModelInfoSchema", () => {
  it("accepts valid model info with all fields", () => {
    const result = ModelInfoSchema.safeParse({
      id: "test-model",
      name: "Test Model",
      description: "A test model for validation",
      tier: "free",
      recommended: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid model info without optional recommended field", () => {
    const result = ModelInfoSchema.safeParse({
      id: "test-model",
      name: "Test Model",
      description: "A test model for validation",
      tier: "paid",
    });
    expect(result.success).toBe(true);
  });

  it("rejects model info with invalid data", () => {
    expect(ModelInfoSchema.safeParse({ id: "test-model", name: "Test Model" }).success).toBe(false);
    expect(ModelInfoSchema.safeParse({ id: "test-model", name: "Test Model", description: "A test model", tier: "premium" }).success).toBe(false);
  });
});

describe("ProviderInfoSchema", () => {
  it("accepts valid provider info", () => {
    const result = ProviderInfoSchema.safeParse({
      id: "gemini",
      name: "Google Gemini",
      defaultModel: "gemini-2.5-flash",
      models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects provider info with invalid data", () => {
    expect(ProviderInfoSchema.safeParse({ id: "openai", name: "OpenAI", defaultModel: "gpt-4", models: ["gpt-4"] }).success).toBe(false);
    expect(ProviderInfoSchema.safeParse({ id: "gemini", name: "Google Gemini" }).success).toBe(false);
    expect(ProviderInfoSchema.safeParse({ id: "gemini", name: "Google Gemini", defaultModel: "gemini-2.5-flash", models: "gemini-2.5-flash" }).success).toBe(false);
  });
});

const VALID_TIMESTAMP = "2024-01-01T00:00:00.000Z";

function createBaseUserConfig(overrides = {}) {
  return {
    provider: "gemini",
    createdAt: VALID_TIMESTAMP,
    updatedAt: VALID_TIMESTAMP,
    ...overrides,
  };
}

function createBaseSaveConfigRequest(overrides = {}) {
  return {
    provider: "gemini",
    apiKey: "test-api-key-12345",
    ...overrides,
  };
}

describe("UserConfigSchema", () => {
  it("accepts valid config without model", () => {
    const result = UserConfigSchema.safeParse(createBaseUserConfig());
    expect(result.success).toBe(true);
  });

  it("rejects config without provider", () => {
    const result = UserConfigSchema.safeParse({
      createdAt: VALID_TIMESTAMP,
      updatedAt: VALID_TIMESTAMP,
    });
    expect(result.success).toBe(false);
  });

  it("rejects config with invalid timestamps", () => {
    expect(UserConfigSchema.safeParse({ provider: "gemini" }).success).toBe(false);
    expect(UserConfigSchema.safeParse({ provider: "gemini", createdAt: "invalid-date", updatedAt: VALID_TIMESTAMP }).success).toBe(false);
  });

  describe("cross-field model validation", () => {
    it.each(GEMINI_MODELS as unknown as GeminiModel[])(
      "accepts valid gemini model: %s",
      (model) => {
        const result = UserConfigSchema.safeParse(
          createBaseUserConfig({ provider: "gemini", model })
        );
        expect(result.success).toBe(true);
      }
    );

    it.each(["gpt-4", "gpt-4o", "claude-3-opus", "invalid-model"])(
      "rejects invalid model for gemini provider: %s",
      (model) => {
        const result = UserConfigSchema.safeParse(
          createBaseUserConfig({ provider: "gemini", model })
        );
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.path).toContain("model");
          expect(result.error.issues[0]?.message).toBe(
            "Model is not valid for the selected provider"
          );
        }
      }
    );
  });
});

describe("SaveConfigRequestSchema", () => {
  it("accepts valid request without model", () => {
    const result = SaveConfigRequestSchema.safeParse(
      createBaseSaveConfigRequest()
    );
    expect(result.success).toBe(true);
  });

  it("accepts valid request with model", () => {
    const result = SaveConfigRequestSchema.safeParse(
      createBaseSaveConfigRequest({ model: "gemini-2.5-flash" })
    );
    expect(result.success).toBe(true);
  });

  it("rejects request with invalid apiKey", () => {
    expect(SaveConfigRequestSchema.safeParse(createBaseSaveConfigRequest({ apiKey: "" })).success).toBe(false);
    expect(SaveConfigRequestSchema.safeParse({ provider: "gemini" }).success).toBe(false);
  });
});

describe("ConfigErrorCodeSchema", () => {
  it.each([
    "NOT_CONFIGURED",
    "INVALID_PROVIDER",
    "INVALID_API_KEY",
    "CONFIG_NOT_FOUND",
    "CONFIG_WRITE_FAILED",
    "CONFIG_READ_FAILED",
    "INTERNAL_ERROR",
    "UNKNOWN",
  ] as const)("accepts valid error code: %s", (code) => {
    const result = ConfigErrorCodeSchema.safeParse(code);
    expect(result.success).toBe(true);
  });

  it("rejects invalid error code", () => {
    const result = ConfigErrorCodeSchema.safeParse("INVALID_CODE");
    expect(result.success).toBe(false);
  });
});

describe("ConfigErrorSchema", () => {
  it("accepts valid error", () => {
    const result = ConfigErrorSchema.safeParse({
      message: "Configuration not found",
      code: "CONFIG_NOT_FOUND",
    });
    expect(result.success).toBe(true);
  });

  it("rejects error with missing required fields", () => {
    expect(ConfigErrorSchema.safeParse({ code: "CONFIG_NOT_FOUND" }).success).toBe(false);
    expect(ConfigErrorSchema.safeParse({ message: "Error message" }).success).toBe(false);
  });
});

describe("ConfigCheckResponseSchema", () => {
  it("accepts unconfigured response", () => {
    const result = ConfigCheckResponseSchema.safeParse({
      configured: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts configured response with and without model", () => {
    const withModel = ConfigCheckResponseSchema.safeParse({
      configured: true,
      config: { provider: "gemini", model: "gemini-2.5-flash" },
    });
    expect(withModel.success).toBe(true);

    const withoutModel = ConfigCheckResponseSchema.safeParse({
      configured: true,
      config: { provider: "gemini" },
    });
    expect(withoutModel.success).toBe(true);
  });
});

describe("CurrentConfigResponseSchema", () => {
  it("accepts response with provider only", () => {
    const result = CurrentConfigResponseSchema.safeParse({
      provider: "gemini",
    });
    expect(result.success).toBe(true);
  });

  it("accepts response with provider and model", () => {
    const result = CurrentConfigResponseSchema.safeParse({
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
    expect(result.success).toBe(true);
  });

  it("rejects response without provider", () => {
    const result = CurrentConfigResponseSchema.safeParse({
      model: "gemini-2.5-flash",
    });
    expect(result.success).toBe(false);
  });
});

describe("DeleteConfigResponseSchema", () => {
  it("accepts valid response with boolean deleted field", () => {
    expect(DeleteConfigResponseSchema.safeParse({ deleted: true }).success).toBe(true);
    expect(DeleteConfigResponseSchema.safeParse({ deleted: false }).success).toBe(true);
  });

  it("rejects response without deleted field", () => {
    const result = DeleteConfigResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
