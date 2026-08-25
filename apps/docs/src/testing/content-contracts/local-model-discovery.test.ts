import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROVIDER_CONSENT_TEXT } from "@diffgazer/core/schemas/config";
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

  it("documents the one global provider consent and the per-notice re-acceptance it leaves in place", () => {
    const configuration = readAppDoc("reference/configuration.mdx");
    const api = readAppDoc("reference/api.mdx");
    const onboarding = readAppDoc("web/onboarding.mdx");
    const privacy = readAppDoc("concepts/privacy.mdx");
    const providers = readAppDoc("reference/providers.mdx");

    // The consent text the UIs render is the one the docs quote.
    expect(configuration).toContain(PROVIDER_CONSENT_TEXT);
    expect(onboarding).toContain(PROVIDER_CONSENT_TEXT);
    expect(configuration).toMatch(/\| `providerConsent` \|/);
    expect(configuration).toContain("`acknowledgement-required` before any conformance verdict");
    expect(api).toContain('"noticeId": "gemini-hosted-api"');
    expect(api).not.toContain("gemini-billing-privacy");
    // The setup guard answers an unacknowledged record before admission ever
    // sees it; `403` is the recorded-conformance-failure fast-fail alone.
    expect(api).toContain("`503 SETUP_REQUIRED`");
    expect(api).not.toContain("`403 SETUP_REQUIRED`");
    for (const source of [configuration, providers, privacy, onboarding]) {
      expect(source).toMatch(/materially change/);
    }
    // No page still describes the retired per-product checkbox.
    expect(onboarding).not.toMatch(/Accept the product notice/);
    expect(privacy).not.toMatch(/accept explicitly during setup/);
  });

  it("documents the just-in-time provider data notice instead of a Providers-page banner", () => {
    const configuration = readAppDoc("reference/configuration.mdx");
    const onboarding = readAppDoc("web/onboarding.mdx");
    const privacy = readAppDoc("concepts/privacy.mdx");
    const firstReview = readAppDoc("getting-started/first-review.mdx");
    const settings = readAppDoc("web/settings.mdx");
    const providers = readAppDoc("reference/providers.mdx");

    // The gate, its two answers, and the way back to a declined notice.
    expect(configuration).toContain("**Provider data notice**");
    expect(configuration).toContain("**Accept and continue**");
    expect(configuration).toContain("**Not now**");
    expect(configuration).toContain("Consent required to run reviews");
    for (const source of [onboarding, privacy, firstReview]) {
      expect(source).toContain("Provider data notice");
    }
    // The settings hub reads the accepted notice back; nothing re-prompts.
    expect(settings).toMatch(/\| Provider data notice \|/);
    // The banner is gone: no page still says the consent is accepted on the Providers page.
    for (const source of [configuration, providers, onboarding]) {
      expect(source).not.toMatch(/on the Providers page/);
    }
  });
});
