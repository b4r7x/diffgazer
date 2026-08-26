import { describe, expect, it } from "vitest";
import { getCatalogBillingRange, getModelBilling, producesTextOutput } from "./model-capability.js";
import { ModelsDevModelSchema } from "./schema.js";

const model = (overrides: Record<string, unknown>) =>
  ModelsDevModelSchema.parse({ id: "m", name: "M", ...overrides });

describe("producesTextOutput", () => {
  it("keeps text-only and undeclared-modality models", () => {
    expect(producesTextOutput(model({ modalities: { output: ["text"] } }))).toBe(true);
    expect(producesTextOutput(model({}))).toBe(true);
  });

  it("rejects audio-, image-, and video-only models", () => {
    expect(producesTextOutput(model({ modalities: { output: ["audio"] } }))).toBe(false);
    expect(producesTextOutput(model({ modalities: { output: ["image"] } }))).toBe(false);
    expect(producesTextOutput(model({ modalities: { output: ["video"] } }))).toBe(false);
  });

  it("rejects a mixed-output model unless it explicitly claims structured output", () => {
    expect(producesTextOutput(model({ modalities: { output: ["text", "image"] } }))).toBe(false);
    expect(
      producesTextOutput(
        model({ modalities: { output: ["text", "image"] }, structured_output: false }),
      ),
    ).toBe(false);
    expect(
      producesTextOutput(
        model({ modalities: { output: ["text", "image"] }, structured_output: true }),
      ),
    ).toBe(true);
  });
});

describe("getModelBilling", () => {
  it("reports a zero-priced model as free", () => {
    expect(getModelBilling(model({ cost: { input: 0, output: 0 } }))).toBe("free");
  });

  it("reports any priced token direction as paid", () => {
    expect(getModelBilling(model({ cost: { input: 0, output: 0.4 } }))).toBe("paid");
    expect(getModelBilling(model({ cost: { input: 0.1, output: 0 } }))).toBe("paid");
  });

  it("reports an unpriced model as unknown rather than paid", () => {
    expect(getModelBilling(model({}))).toBe("unknown");
  });
});

describe("getCatalogBillingRange", () => {
  it("reports a product offering both zero-priced and priced models as mixed", () => {
    expect(getCatalogBillingRange(["free", "paid"])).toBe("mixed");
    expect(getCatalogBillingRange(["paid", "unknown", "free"])).toBe("mixed");
  });

  it("reports a single-priced product as that price", () => {
    expect(getCatalogBillingRange(["free", "free"])).toBe("free");
    expect(getCatalogBillingRange(["paid", "paid"])).toBe("paid");
  });

  it("lets unpriced models abstain rather than vote for a tier", () => {
    expect(getCatalogBillingRange(["unknown", "paid"])).toBe("paid");
    expect(getCatalogBillingRange(["unknown", "free"])).toBe("free");
  });

  it("reports a product with nothing to offer, or nothing priced, as unknown", () => {
    expect(getCatalogBillingRange([])).toBe("unknown");
    expect(getCatalogBillingRange(["unknown", "unknown"])).toBe("unknown");
  });
});
