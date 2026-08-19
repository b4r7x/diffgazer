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
  it("drops unwanted providers and keeps every model of a wanted one, sorted", () => {
    const trimmed = trimCatalogSnapshot(fixture, new Set(["text-provider"]));

    const textProvider = requireValue(trimmed["text-provider"], "trimmed text-provider");

    expect(Object.keys(trimmed)).toEqual(["text-provider"]);
    expect(Object.keys(textProvider.models)).toEqual([
      "audio-only",
      "image-only",
      "missing-modality",
      "mixed-output",
      "null-capability",
      "text-only",
      "video-only",
    ]);
  });

  // The offline tier must still know a withheld id, or a provider's live list
  // would offer a TTS/image model the catalog refused; text models carry no
  // modalities since nothing reads them past the filter.
  it("keeps only the withholding output modality", () => {
    const trimmed = trimCatalogSnapshot(fixture, new Set(["text-provider"]));
    const models = requireValue(trimmed["text-provider"], "trimmed text-provider").models;

    expect(models["audio-only"]).toEqual({
      id: "audio-only",
      name: "Audio Only",
      modalities: { output: ["audio"] },
    });
    for (const id of ["text-only", "mixed-output", "missing-modality"]) {
      expect(models[id]).not.toHaveProperty("modalities");
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
