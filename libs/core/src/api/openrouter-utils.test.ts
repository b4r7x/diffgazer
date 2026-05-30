import { describe, expect, it } from "vitest";
import type { OpenRouterModel } from "@diffgazer/core/schemas/config";
import { isOpenRouterCompatible, mapOpenRouterModels } from "./openrouter-utils";

describe("isOpenRouterCompatible", () => {
  it.each([
    { label: "supportedParameters=['response_format']", input: { supportedParameters: ["response_format"] }, expected: true },
    { label: "supportedParameters=['structured_outputs']", input: { supportedParameters: ["structured_outputs"] }, expected: true },
    { label: "supportedParameters=['temperature','top_p']", input: { supportedParameters: ["temperature", "top_p"] }, expected: false },
    { label: "supportedParameters=undefined", input: { supportedParameters: undefined }, expected: false },
    { label: "supportedParameters omitted", input: {}, expected: false },
  ])("returns $expected for $label", ({ input, expected }) => {
    expect(isOpenRouterCompatible(input)).toBe(expected);
  });
});

function makeModel(overrides: Partial<OpenRouterModel> & Pick<OpenRouterModel, "id">): OpenRouterModel {
  // Cast: the literal omits no required field, but the spread's inferred type is
  // widened by `Partial<OpenRouterModel>`, so the assertion restores the full shape.
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
      // Cast: deliberately feeds `undefined` into the non-optional `description`
      // to exercise the runtime id-fallback path that types alone forbid.
      makeModel({ id: "openrouter/no-desc", name: "n", description: undefined as unknown as string }),
    ]);
    expect(mapped?.description).toBe("openrouter/no-desc");
  });

  it("returns an empty list for empty input", () => {
    expect(mapOpenRouterModels([])).toEqual([]);
  });
});
