import { describe, expect, it } from "vitest";
import type { RunnableProductId } from "../schemas/config/transports.js";
import {
  getProviderDetailModelLabel,
  PROVIDER_DETAIL_ACTION_LABELS,
  PROVIDER_DETAIL_EMPTY_LABEL,
} from "./detail-presentation.js";
import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "./product-registry.js";

describe("provider detail presentation", () => {
  it("defines shared action and empty-state labels", () => {
    expect(PROVIDER_DETAIL_ACTION_LABELS).toEqual({
      selectProvider: "Select Provider",
      configureApiKey: "Configure API Key",
      removeKey: "Remove Key",
      selectModel: "Select Model",
    });
    expect(PROVIDER_DETAIL_EMPTY_LABEL).toBe("Select a provider to view details");
  });

  it.each([
    {
      state: "selected model",
      productId: "gemini",
      model: "gemini-2.5-pro",
      defaultModel: "gemini-2.5-flash",
      expected: "gemini-2.5-pro",
    },
    {
      state: "default model",
      productId: "gemini",
      model: undefined,
      defaultModel: "gemini-2.5-flash",
      expected: "gemini-2.5-flash (default)",
    },
    {
      state: "required model",
      productId: "openrouter",
      model: undefined,
      defaultModel: undefined,
      expected: "Model required",
    },
    {
      state: "missing default",
      productId: "groq",
      model: undefined,
      defaultModel: undefined,
      expected: "No default model",
    },
  ] as const satisfies readonly {
    state: string;
    productId: RunnableProductId;
    model: string | undefined;
    defaultModel: string | undefined;
    expected: string;
  }[])("formats the $state state", ({ productId, model, defaultModel, expected }) => {
    expect(getProviderDetailModelLabel(productId, model, defaultModel)).toBe(expected);
  });

  it("asks for an explicit model for every pinned-downstream-route product", () => {
    const pinnedProductIds = SELECTABLE_PRODUCT_IDS.filter(
      (productId) => PRODUCT_REGISTRY[productId].modelPolicy.kind === "pinned-downstream-route",
    );

    expect(pinnedProductIds.length).toBeGreaterThan(0);
    for (const productId of pinnedProductIds) {
      // A registered default must never override the pinned-route requirement.
      expect(getProviderDetailModelLabel(productId, undefined, "some-default")).toBe(
        "Model required",
      );
    }
  });
});
