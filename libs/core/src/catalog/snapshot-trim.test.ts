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
        release_date: "2026-01-15",
        knowledge: "2025-10",
      },
      "mixed-output": {
        id: "mixed-output",
        name: "Mixed Output",
        modalities: { output: ["text", "image"] },
      },
      "mixed-output-structured": {
        id: "mixed-output-structured",
        name: "Mixed Output Structured",
        structured_output: true,
        modalities: { output: ["text", "image"] },
      },
      "audio-only": {
        id: "audio-only",
        name: "Audio Only",
        modalities: { output: ["audio"] },
        release_date: "2026-01-15",
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
      "mixed-output-structured",
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
    // Mixed output with no structured-output claim is withheld too, so its
    // modalities must survive for the offline re-evaluation.
    expect(models["mixed-output"]).toEqual({
      id: "mixed-output",
      name: "Mixed Output",
      modalities: { output: ["text", "image"] },
    });
    for (const id of ["text-only", "mixed-output-structured", "missing-modality"]) {
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

  // The picker sorts newest first on the release date, so it must survive the
  // trim — but only on rows the transform can offer: a withheld row carries
  // nothing beyond what withholds it.
  it("retains the release date on offerable rows and drops it from withheld ones", () => {
    const trimmed = trimCatalogSnapshot(fixture, new Set(["text-provider"]));
    const models = requireValue(trimmed["text-provider"], "trimmed text-provider").models;

    expect(models["text-only"]).toEqual({
      id: "text-only",
      name: "Text Only",
      release_date: "2026-01-15",
    });
    expect(models["audio-only"]).not.toHaveProperty("release_date");
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
