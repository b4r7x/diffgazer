import { describe, it, expect } from "vitest";
import type {
  ProviderInfo,
  ProviderStatus,
} from "@diffgazer/core/schemas/config";
import { mapProvidersWithStatus } from "./list.js";

const PROVIDERS: ProviderInfo[] = [
  { id: "gemini", name: "Gemini", defaultModel: "gemini-2.5-flash" },
  { id: "zai", name: "Z.AI", defaultModel: "glm-4.7" },
  { id: "openrouter", name: "OpenRouter", defaultModel: "" },
];

describe("mapProvidersWithStatus", () => {
  it("marks active provider with displayStatus 'active'", () => {
    const statuses: ProviderStatus[] = [
      { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
    ];
    const result = mapProvidersWithStatus(statuses, PROVIDERS);
    const gemini = result.find((p) => p.id === "gemini");
    expect(gemini?.displayStatus).toBe("active");
    expect(gemini?.hasApiKey).toBe(true);
    expect(gemini?.isActive).toBe(true);
    expect(gemini?.model).toBe("gemini-2.5-flash");
  });

  it("marks provider with API key but not active as 'configured'", () => {
    const statuses: ProviderStatus[] = [
      { provider: "zai", hasApiKey: true, isActive: false },
    ];
    const result = mapProvidersWithStatus(statuses, PROVIDERS);
    const zai = result.find((p) => p.id === "zai");
    expect(zai?.displayStatus).toBe("configured");
  });

  it("marks provider with no API key as 'needs-key'", () => {
    const result = mapProvidersWithStatus([], PROVIDERS);
    expect(result.every((p) => p.displayStatus === "needs-key")).toBe(true);
    expect(result.every((p) => !p.hasApiKey)).toBe(true);
    expect(result.every((p) => !p.isActive)).toBe(true);
  });

  it("preserves provider info (name, defaultModel)", () => {
    const result = mapProvidersWithStatus([], PROVIDERS);
    const openRouter = result.find((p) => p.id === "openrouter");
    expect(openRouter?.name).toBe("OpenRouter");
    expect(openRouter?.defaultModel).toBe("");
  });

  it("returns same order as input providers", () => {
    const result = mapProvidersWithStatus([], PROVIDERS);
    expect(result.map((p) => p.id)).toEqual(["gemini", "zai", "openrouter"]);
  });
});
