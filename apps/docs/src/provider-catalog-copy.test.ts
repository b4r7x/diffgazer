import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const contentRoot = resolve(import.meta.dirname, "../content/docs/app/concepts");

function readConcept(name: string): string {
  return readFileSync(resolve(contentRoot, `${name}.mdx`), "utf8");
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

  it("names the five shared-catalog providers and the credential-bearing OpenRouter route", () => {
    const privacy = readConcept("privacy");

    for (const provider of ["Google Gemini", "Z.AI", "Z.AI Coding Plan", "Groq", "Cerebras"]) {
      expect(privacy).toContain(provider);
    }
    expect(privacy).toContain("https://models.dev/api.json");
    expect(privacy).toContain("https://openrouter.ai/api/v1/models");
    expect(privacy).toContain("with your OpenRouter API key");
  });
});
