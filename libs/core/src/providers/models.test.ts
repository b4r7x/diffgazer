import { describe, expect, it } from "vitest";
import type { ModelInfo } from "../schemas/config/index.js";
import { LIVE_ONLY_MODEL_DESCRIPTION } from "./catalog-discovery-reasons.js";
import { cycleTierFilter, filterModels, TIER_FILTERS } from "./models.js";

const makeModel = (
  id: string,
  name: string,
  tier: ModelInfo["tier"],
  description = "",
): ModelInfo => ({ id, name, tier, description });

const MODELS: ModelInfo[] = [
  makeModel("gpt-4", "GPT-4", "paid", "Most capable model"),
  makeModel("gpt-35", "GPT-3.5", "free", "Fast and cheap"),
  makeModel("claude", "Claude", "paid", "Anthropic model"),
  makeModel("gemini", "Gemini", "free", "Google model"),
  makeModel("ollama-local", "Ollama", "local", "Local runtime"),
  makeModel("codex-ambient", "Codex CLI", "ambient", "Vendor-managed local auth"),
  makeModel("glm-5.3", "glm-5.3", "unknown", LIVE_ONLY_MODEL_DESCRIPTION),
];

const ids = (models: ModelInfo[]) => models.map((m) => m.id);

describe("filterModels", () => {
  it("returns all models when filter is 'all' and no search", () => {
    expect(ids(filterModels(MODELS, "all", ""))).toEqual([
      "gpt-4",
      "gpt-35",
      "claude",
      "gemini",
      "ollama-local",
      "codex-ambient",
      "glm-5.3",
    ]);
  });

  it("hides unknown-tier rows under free and paid, keeps them under all", () => {
    expect(ids(filterModels(MODELS, "free", ""))).not.toContain("glm-5.3");
    expect(ids(filterModels(MODELS, "paid", ""))).not.toContain("glm-5.3");
    expect(ids(filterModels(MODELS, "all", ""))).toContain("glm-5.3");
  });

  it("filters to free tier only, excluding neutral local and ambient models", () => {
    expect(ids(filterModels(MODELS, "free", ""))).toEqual(["gpt-35", "gemini"]);
  });

  it("filters to paid tier only, excluding neutral local and ambient models", () => {
    expect(ids(filterModels(MODELS, "paid", ""))).toEqual(["gpt-4", "claude"]);
  });

  it("filters by search query against id, name, and description", () => {
    expect(ids(filterModels(MODELS, "all", "gpt"))).toEqual(["gpt-4", "gpt-35"]);
    expect(ids(filterModels(MODELS, "all", "anthropic"))).toEqual(["claude"]);
    expect(
      ids(
        filterModels(
          [makeModel("anthropic/claude-sonnet-4", "Claude Sonnet 4", "free", "200K context")],
          "all",
          "anthropic/claude-sonnet-4",
        ),
      ),
    ).toEqual(["anthropic/claude-sonnet-4"]);
    expect(
      ids(
        filterModels(
          [makeModel("openai/gpt-oss-120b", "GPT OSS 120B", "free", "128K context window")],
          "all",
          "openai/gpt-oss-120b",
        ),
      ),
    ).toEqual(["openai/gpt-oss-120b"]);
  });

  it("combines tier filter with search", () => {
    expect(ids(filterModels(MODELS, "free", "gemini"))).toEqual(["gemini"]);
  });

  it("ignores leading/trailing whitespace in search", () => {
    expect(ids(filterModels(MODELS, "all", "  gpt  "))).toEqual(["gpt-4", "gpt-35"]);
  });

  it("returns empty array when no models match", () => {
    expect(filterModels(MODELS, "all", "nonexistent-model")).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(filterModels([], "all", "")).toEqual([]);
  });
});

describe("cycleTierFilter", () => {
  it("cycles all -> free -> paid -> all", () => {
    expect(cycleTierFilter("all")).toBe("free");
    expect(cycleTierFilter("free")).toBe("paid");
    expect(cycleTierFilter("paid")).toBe("all");
  });

  it("matches TIER_FILTERS order", () => {
    expect(TIER_FILTERS).toEqual(["all", "free", "paid"]);
  });
});
