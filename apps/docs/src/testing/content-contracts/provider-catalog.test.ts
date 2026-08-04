import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROVIDER_OVERLAY } from "@diffgazer/core/catalog";
import {
  CANDIDATE_VERDICTS,
  PRODUCT_REGISTRY,
  SELECTABLE_PRODUCT_IDS,
} from "@diffgazer/core/providers";
import {
  CANDIDATE_PRODUCT_IDS,
  DEFERRED_PRODUCT_IDS,
  EXPERIMENTAL_PRODUCT_IDS,
  REJECTED_PRODUCT_IDS,
} from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";

const contentRoot = resolve(import.meta.dirname, "../../../content/docs/app");
const conceptsRoot = resolve(contentRoot, "concepts");

const MATRIX_SECTION_HEADING = "## Canonical support matrix";
const MATRIX_COLUMNS = [
  "id",
  "product",
  "status",
  "transport",
  "credential",
  "endpoint",
  "structured-output",
  "privacy-billing",
  "enablement-gate",
  "falsifier",
] as const;

const FORBIDDEN_EXAMPLE_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]+|Bearer\s+[A-Za-z0-9+/=]{8,})\b/;

function readDoc(...segments: string[]): string {
  return readFileSync(resolve(contentRoot, ...segments), "utf8");
}

function readConcept(name: string): string {
  return readFileSync(resolve(conceptsRoot, `${name}.mdx`), "utf8");
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

function extractMatrixSection(content: string): string {
  const start = content.indexOf(MATRIX_SECTION_HEADING);
  if (start === -1) {
    throw new Error("Canonical support matrix section not found");
  }
  const afterStart = content.slice(start);
  const endMatch = afterStart.slice(MATRIX_SECTION_HEADING.length).match(/\n## (?!#)/);
  return endMatch?.index == null
    ? afterStart
    : afterStart.slice(0, MATRIX_SECTION_HEADING.length + endMatch.index);
}

function parseMatrixRows(
  content: string,
): Map<string, Record<(typeof MATRIX_COLUMNS)[number], string>> {
  const section = extractMatrixSection(content);
  const rows = new Map<string, Record<(typeof MATRIX_COLUMNS)[number], string>>();

  for (const line of section.split("\n")) {
    if (!line.startsWith("| `")) continue;

    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    if (cells.length !== MATRIX_COLUMNS.length) continue;
    const idCell = cells[0];
    if (idCell === undefined || idCell === "ID") continue;

    const id = idCell.replaceAll("`", "");
    const row = Object.fromEntries(
      MATRIX_COLUMNS.map((column, index) => [column, cells[index] ?? ""]),
    ) as Record<(typeof MATRIX_COLUMNS)[number], string>;
    rows.set(id, row);
  }

  return rows;
}

function structuredOutputLabel(
  product: (typeof PRODUCT_REGISTRY)[keyof typeof PRODUCT_REGISTRY],
): string {
  if (product.kind !== "runnable") return "";
  switch (product.admission.structuredOutput) {
    case "strict-json-schema":
      return "strict JSON schema";
    case "json-object-local-validation":
      return "JSON object with local validation";
    case "pinned-cli-terminal-schema":
      return "pinned CLI terminal schema";
  }
}

describe("provider support matrix", () => {
  const providersReference = readDoc("reference", "providers.mdx");
  const matrixRows = parseMatrixRows(providersReference);

  it("provider support matrix is total and complete", () => {
    const expectedIds = [...SELECTABLE_PRODUCT_IDS, ...CANDIDATE_PRODUCT_IDS];
    expect(matrixRows.size).toBe(expectedIds.length);
    expect([...matrixRows.keys()].toSorted()).toEqual([...expectedIds].toSorted());

    for (const productId of SELECTABLE_PRODUCT_IDS) {
      const row = matrixRows.get(productId);
      expect(row, productId).toBeDefined();
      expect(row?.status).toBe("add-now");
      for (const column of MATRIX_COLUMNS) {
        expect(row?.[column], `${productId}.${column}`).toBeTruthy();
      }
    }

    for (const productId of EXPERIMENTAL_PRODUCT_IDS) {
      expect(matrixRows.get(productId)?.status).toBe("experimental");
    }
    for (const productId of DEFERRED_PRODUCT_IDS) {
      expect(matrixRows.get(productId)?.status).toBe("deferred");
    }
    for (const productId of REJECTED_PRODUCT_IDS) {
      expect(matrixRows.get(productId)?.status).toBe("rejected");
    }

    expect(matrixRows.get("github-models")).toMatchObject({
      status: "rejected",
      product: CANDIDATE_VERDICTS["github-models"].name,
    });
    expect(providersReference).not.toMatch(/GitHub Models.*(?:selectable|enabled|available)/i);
  });

  it("matches product registry names, status, and notices without volatile quota promises", () => {
    for (const productId of SELECTABLE_PRODUCT_IDS) {
      const product = PRODUCT_REGISTRY[productId];
      const row = matrixRows.get(productId);
      expect(row?.product).toBe(product.presentation.name);
      expect(row?.transport).toBe(product.transportFamily);
      expect(row?.["structured-output"]).toBe(structuredOutputLabel(product));
      expect(row?.["privacy-billing"]).toContain(product.notice.billing[0]);
      expect(row?.["privacy-billing"]).toContain(product.notice.privacy[0]);
      expect(row?.["enablement-gate"]).toContain(product.admission.requiredChecks[0]);
      expect(row?.["privacy-billing"]).not.toMatch(
        /\b(?:1M tokens per day|unlimited free|always free|guaranteed quota)\b/i,
      );
      expect(row?.falsifier).not.toMatch(
        /\b(?:1M tokens per day|unlimited free|always free|guaranteed quota)\b/i,
      );
      if (!row?.["privacy-billing"].includes("not presented as zero retention")) {
        expect(row?.["privacy-billing"]).not.toMatch(/\bzero retention\b/i);
      }
    }

    for (const productId of CANDIDATE_PRODUCT_IDS) {
      const verdict = CANDIDATE_VERDICTS[productId];
      const row = matrixRows.get(productId);
      expect(row?.product).toBe(verdict.name);
      expect(row?.falsifier).toBe(verdict.reconsiderWhen);
      expect(row?.["privacy-billing"]).toContain(verdict.reason);
      expect(row?.["privacy-billing"]).not.toMatch(
        /\b(?:1M tokens per day|unlimited free|always free|guaranteed quota)\b/i,
      );
    }

    expect(providersReference).not.toMatch(FORBIDDEN_EXAMPLE_PATTERN);
  });
});

describe("Web Ink canonical terminology matches", () => {
  const providersAndModels = readConcept("providers-and-models");
  const providersReference = readDoc("reference", "providers.mdx");

  it("describes exactly thirteen selectable products with registry names", () => {
    expect(providersAndModels).toContain("thirteen selectable products");
    for (const productId of SELECTABLE_PRODUCT_IDS) {
      const name = PRODUCT_REGISTRY[productId].presentation.name;
      expect(providersAndModels).toContain(name);
      expect(providersReference).toContain(name);
    }
  });

  it("keeps the frozen-verdict language aligned with registry policy", () => {
    expect(providersAndModels).toContain(
      "A compatible endpoint, free credit, or local binary cannot override the frozen verdict",
    );
  });
});

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

  it("names shared-catalog hosted products and the credential-bearing OpenRouter route", () => {
    const privacy = readConcept("privacy");
    const catalogSection = extractSection(privacy, "Model-catalog requests, during setup");

    const sharedCatalogProducts = SELECTABLE_PRODUCT_IDS.filter(
      (productId) => PROVIDER_OVERLAY[productId] !== undefined && productId !== "openrouter",
    );

    for (const productId of sharedCatalogProducts) {
      expect(catalogSection).toContain(PRODUCT_REGISTRY[productId].presentation.name);
    }
    expect(catalogSection).toContain("https://models.dev/api.json");
    expect(catalogSection).toContain("https://openrouter.ai/api/v1/models");
    expect(catalogSection).toContain("with your OpenRouter API key");
  });
});
