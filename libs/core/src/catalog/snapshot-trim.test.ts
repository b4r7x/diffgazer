import { describe, expect, it } from "vitest";
import { requireValue } from "../testing/assertions.js";
import { ModelsDevCatalogSchema } from "./schema.js";
import { trimCatalogSnapshot } from "./snapshot-trim.js";

const fixture = ModelsDevCatalogSchema.parse({
  "text-provider": {
    id: "text-provider",
    name: "Text Provider",
    models: {
      "text-only": {
        id: "text-only",
        name: "Text Only",
        modalities: { output: ["text"] },
      },
      "mixed-output": {
        id: "mixed-output",
        name: "Mixed Output",
        modalities: { output: ["text", "image"] },
      },
      "audio-only": {
        id: "audio-only",
        name: "Audio Only",
        modalities: { output: ["audio"] },
      },
      "image-only": {
        id: "image-only",
        name: "Image Only",
        modalities: { output: ["image"] },
      },
      "video-only": {
        id: "video-only",
        name: "Video Only",
        modalities: { output: ["video"] },
      },
      "missing-modality": {
        id: "missing-modality",
        name: "Missing Modality",
        structured_output: true,
      },
      "null-capability": {
        id: "null-capability",
        name: "Null Capability",
        structured_output: null,
      },
    },
  },
  "other-provider": {
    id: "other-provider",
    name: "Other Provider",
    models: {
      "ignored-model": {
        id: "ignored-model",
        name: "Ignored Model",
      },
    },
  },
});

describe("trimCatalogSnapshot", () => {
  it("filters non-text models and unwanted providers", () => {
    const trimmed = trimCatalogSnapshot(fixture, new Set(["text-provider"]));

    const textProvider = requireValue(trimmed["text-provider"], "trimmed text-provider");

    expect(Object.keys(trimmed)).toEqual(["text-provider"]);
    expect(Object.keys(textProvider.models)).toEqual([
      "missing-modality",
      "mixed-output",
      "null-capability",
      "text-only",
    ]);
    for (const model of Object.values(textProvider.models)) {
      expect(model).not.toHaveProperty("modalities");
    }
  });

  // The capability filter has nothing to read once modalities are gone, so the
  // snapshot has to carry the upstream declaration forward.
  it("retains the structured-output declaration the picker filter needs", () => {
    const trimmed = trimCatalogSnapshot(fixture, new Set(["text-provider"]));

    expect(trimmed["text-provider"]?.models["missing-modality"]?.structured_output).toBe(true);
    expect(trimmed["text-provider"]?.models["text-only"]).not.toHaveProperty("structured_output");
  });

  // Absent and null both mean "unknown", so the snapshot carries one spelling.
  it("collapses an upstream null declaration to an absent one", () => {
    const trimmed = trimCatalogSnapshot(fixture, new Set(["text-provider"]));

    expect(trimmed["text-provider"]?.models["null-capability"]).toBeDefined();
    expect(trimmed["text-provider"]?.models["null-capability"]).not.toHaveProperty(
      "structured_output",
    );
  });
});
