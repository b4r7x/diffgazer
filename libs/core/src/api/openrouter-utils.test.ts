import { describe, expect, it } from "vitest";
import type { OpenRouterModel } from "@diffgazer/core/schemas/config";
import { isOpenRouterCompatible, mapOpenRouterModels } from "./openrouter-utils.js";

describe("isOpenRouterCompatible", () => {
  it("accepts a model that supports response_format", () => {
    expect(isOpenRouterCompatible({ supportedParameters: ["response_format"] })).toBe(true);
  });

  it("accepts a model that supports structured_outputs", () => {
    expect(isOpenRouterCompatible({ supportedParameters: ["structured_outputs"] })).toBe(true);
  });

  it("rejects a model that lists neither structured parameter", () => {
    expect(
      isOpenRouterCompatible({ supportedParameters: ["temperature", "top_p"] }),
    ).toBe(false);
  });

  it("treats missing supportedParameters as incompatible", () => {
    expect(isOpenRouterCompatible({ supportedParameters: undefined })).toBe(false);
    expect(isOpenRouterCompatible({})).toBe(false);
  });
});

function makeModel(overrides: Partial<OpenRouterModel> & Pick<OpenRouterModel, "id">): OpenRouterModel {
  return {
    name: "",
    description: "",
    contextLength: 0,
    pricing: { prompt: "0", completion: "0" },
    isFree: false,
    ...overrides,
  } as OpenRouterModel;
}

describe("mapOpenRouterModels", () => {
  it("maps id, name, description, and tier from the source model", () => {
    const result = mapOpenRouterModels([
      makeModel({ id: "openrouter/foo", name: "Foo", description: "Foo desc", isFree: true }),
      makeModel({ id: "openrouter/bar", name: "Bar", description: "Bar desc", isFree: false }),
    ]);

    expect(result).toEqual([
      { id: "openrouter/foo", name: "Foo", description: "Foo desc", tier: "free" },
      { id: "openrouter/bar", name: "Bar", description: "Bar desc", tier: "paid" },
    ]);
  });

  it("falls back to the id when name is empty", () => {
    const [mapped] = mapOpenRouterModels([
      makeModel({ id: "openrouter/no-name", name: "", isFree: true }),
    ]);
    expect(mapped?.name).toBe("openrouter/no-name");
  });

  it("falls back to the id when description is missing", () => {
    const [mapped] = mapOpenRouterModels([
      makeModel({ id: "openrouter/no-desc", name: "n", description: undefined as unknown as string }),
    ]);
    expect(mapped?.description).toBe("openrouter/no-desc");
  });

  it("returns an empty list for empty input", () => {
    expect(mapOpenRouterModels([])).toEqual([]);
  });
});
