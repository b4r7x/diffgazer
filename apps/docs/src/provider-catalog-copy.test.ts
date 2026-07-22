import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AVAILABLE_PROVIDERS, OPENROUTER_PROVIDER_ID } from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";

const contentRoot = resolve(import.meta.dirname, "../content/docs/app/concepts");

function readConcept(name: string): string {
  return readFileSync(resolve(contentRoot, `${name}.mdx`), "utf8");
}

function extractSection(content: string, heading: string): string {
  const lines = content.split("\n");
  const startIndex = lines.findIndex((line) => line.trim() === `### ${heading}`);
  if (startIndex === -1) {
    throw new Error(`Section "${heading}" not found`);
  }
  const rest = lines.slice(startIndex + 1);
  const endOffset = rest.findIndex((line) => /^#{1,6}\s/.test(line));
  return (endOffset === -1 ? rest : rest.slice(0, endOffset)).join("\n");
}

describe("provider catalog privacy copy", () => {
  it("discloses pre-review catalog traffic in the overview and links to full privacy details", () => {
    const overview = readConcept("how-it-works");

    expect(overview).toContain("pre-review model-catalog lookup");
    expect(overview).toContain("models.dev catalog");
    expect(overview).toContain("OpenRouter API key");
    expect(overview).toContain("[Privacy](/app/concepts/privacy)");
    expect(overview).not.toContain("nothing leaves it until you start a review");
    expect(overview).not.toContain("The only thing that leaves your computer");
  });

  it("names every derived shared-catalog provider and the credential-bearing OpenRouter route", () => {
    const privacy = readConcept("privacy");
    const catalogSection = extractSection(privacy, "Model-catalog requests, during setup");

    const sharedCatalogProviders = AVAILABLE_PROVIDERS.filter(
      (provider) => provider.id !== OPENROUTER_PROVIDER_ID,
    );
    for (const provider of sharedCatalogProviders) {
      expect(catalogSection).toContain(provider.name);
    }
    expect(catalogSection).toContain("https://models.dev/api.json");
    expect(catalogSection).toContain("https://openrouter.ai/api/v1/models");
    expect(catalogSection).toContain("with your OpenRouter API key");
  });
});
