import { describe, expect, it } from "vitest";
import type { SetupStatus } from "../../schemas/config/index.js";
import {
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  classifyReviewStreamError,
  describeReviewStartError,
  getApiKeyMissingCopy,
} from "./error-guidance.js";

describe("review error-guidance presentation", () => {
  it("derives setup copy from the authoritative missing fields", () => {
    const providerMissing: SetupStatus["missing"] = ["provider"];
    const modelMissing = ["model"] as const satisfies Readonly<SetupStatus["missing"]>;
    const providerAndModelMissing: SetupStatus["missing"] = ["provider", "model"];

    expect(getApiKeyMissingCopy({ provider: "openai", missing: providerMissing })).toEqual({
      title: "API Key Required",
      body: "No API key configured for openai. Add your API key in Settings to start reviewing code.",
    });
    expect(getApiKeyMissingCopy({ provider: "openai", missing: modelMissing })).toEqual({
      title: "Model Required",
      body: "No model selected for openai. Set up a model in Settings to start reviewing code.",
    });
    expect(getApiKeyMissingCopy({ missing: providerAndModelMissing })).toEqual({
      title: "API Key Required",
      body: "No API key configured. Add your API key in Settings to start reviewing code.",
    });
    const secretsStorageWithOthersMissing: SetupStatus["missing"] = [
      "provider",
      "model",
      "secretsStorage",
    ];
    expect(
      getApiKeyMissingCopy({ provider: "openai", missing: secretsStorageWithOthersMissing }),
    ).toEqual({
      title: "Secrets Storage Required",
      body: "Choose a secrets storage backend in Settings before starting a review.",
    });
    expect(CONFIGURATION_ERROR_COPY).toEqual({
      title: "Configuration Unavailable",
      body: "Diffgazer could not load the current configuration. Retry the request or return home.",
    });
    expect(CONFIGURE_PROVIDER_LABEL).toBe("Configure Provider");
  });

  it.each([
    {
      code: "API_KEY_MISSING",
      title: "API Key Missing",
      message: "API key not found. Add one in Settings → Providers.",
    },
    {
      code: "UNSUPPORTED_PROVIDER",
      title: "Provider Not Configured",
      message: "Pick an AI provider in Settings → Providers.",
    },
    {
      code: "MODEL_ERROR",
      title: "Model Not Selected",
      message: "API key not found",
    },
    {
      code: "KEYRING_READ_FAILED",
      title: "Credential Storage Unavailable",
      message: "API key not found. Check Settings → Storage.",
    },
  ])("describes $code review start failures", ({ code, title, message }) => {
    const error = Object.assign(new Error("API key not found"), { code, status: 400 });

    expect(describeReviewStartError(error)).toEqual({ title, message });
  });

  it("falls back for unstructured review start failures", () => {
    expect(describeReviewStartError(new Error("network failed"))).toEqual({
      title: "Failed to Start Review",
      message: "Could not create a review session.",
    });
  });

  it("classifies review stream failures by structured code before message fallback", () => {
    expect(classifyReviewStreamError("credentials rejected", "API_KEY_MISSING")).toEqual({
      kind: "api-key",
      title: "API Key Error",
      guidance: "Your API key may be invalid or expired.",
      ctaLabel: "Configure Provider",
    });
    expect(classifyReviewStreamError("API key connection dropped", "STREAM_ERROR")).toEqual({
      kind: "transport",
      title: "Connection Lost",
      guidance: "The review stream was interrupted. Retry to reconnect to the active review.",
      ctaLabel: "Retry",
    });
    expect(classifyReviewStreamError("API-key rejected", "SESSION_STALE").kind).toBe("other");
    expect(classifyReviewStreamError("API-key rejected", null).kind).toBe("api-key");
  });
});
