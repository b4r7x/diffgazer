import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appDocsRoot = resolve(import.meta.dirname, "../../../content/docs/app");

function readAppDoc(path: string): string {
  return readFileSync(resolve(appDocsRoot, path), "utf8");
}

describe("local transport setup docs", () => {
  const skippedReason = "Catalog observations are unavailable for this configuration product.";

  const localDiscoveryDocPaths = [
    "reference/configuration.mdx",
    "getting-started/first-review.mdx",
    "concepts/privacy.mdx",
    "concepts/providers-and-models.mdx",
    "web/onboarding.mdx",
  ] as const;

  it("documents that local products have no picker-side model discovery", () => {
    for (const path of localDiscoveryDocPaths) {
      const source = readAppDoc(path);
      expect(source, path).toContain(skippedReason);
      expect(source, path).not.toMatch(/listed by the local server/i);
      expect(source, path).not.toMatch(/discover exact model IDs from the local server/i);
    }
  });

  it("documents local exact-model selection through the local API", () => {
    for (const path of ["concepts/providers-and-models.mdx", "web/onboarding.mdx"]) {
      const source = readAppDoc(path);
      expect(source, path).toMatch(/`select`/);
      expect(source, path).toMatch(/local API/i);
    }
  });

  it("does not claim the wizard can continue after an external select", () => {
    const wizardBlockedPaths = [
      "getting-started/first-review.mdx",
      "web/onboarding.mdx",
      "concepts/providers-and-models.mdx",
    ] as const;

    for (const path of wizardBlockedPaths) {
      const source = readAppDoc(path);
      expect(source, path).toMatch(/Next.*disabled|cannot complete setup/i);
      expect(source, path).not.toMatch(/continue the wizard/i);
      expect(source, path).not.toMatch(/then continue/i);
      expect(source, path).not.toMatch(
        /`select`[^\n]*then[^\n]*(?:Confirm conformance|Complete Setup)/i,
      );
    }
  });

  it("documents the configuration models read route in the local API reference", () => {
    const source = readAppDoc("reference/api.mdx");

    expect(source).toContain("`GET` | `/api/config/providers/:configurationId/models`");
    expect(source).not.toMatch(/no.*model-listing route/i);
  });

  it("guides local model-missing remediation beyond the hosted picker", () => {
    const source = readAppDoc("operations/troubleshooting.mdx");

    expect(source).toMatch(/local HTTP and local CLI products/i);
    expect(source).toMatch(/skipped catalog reason/i);
    expect(source).toMatch(/`select`/);
    expect(source).not.toMatch(
      /Model missing[\s\S]*Open the model picker, choose a listed exact ID/i,
    );
  });

  it("uses policy-accurate model listing language in providers-and-models", () => {
    const source = readAppDoc("concepts/providers-and-models.mdx");

    expect(source).toContain("discovered-exact");
    expect(source).toContain("discovered-allowlist");
    expect(source).toContain("discovered-family");
    expect(source).toContain("pinned downstream route");
    expect(source).not.toMatch(
      /For every selectable product, the model you select must.*appear in the admitted discovery result/i,
    );
  });

  it("documents notice acknowledgement in local setup sequences", () => {
    const configuration = readAppDoc("reference/configuration.mdx");
    const firstReview = readAppDoc("getting-started/first-review.mdx");

    expect(configuration).toMatch(
      /Local HTTP products[\s\S]*`update` to accept the product notice/,
    );
    expect(configuration).toMatch(/Local CLI products[\s\S]*`update` to accept the account notice/);
    expect(firstReview).toMatch(/`update` again to accept the product notice/);
    expect(firstReview).toMatch(/`update` to accept the account notice/);
  });
});
