import { REGISTRY_ORIGIN } from "@diffgazer/registry";
import { version } from "@diffgazer/ui/package.json";
import { describe, expect, it } from "vitest";
import { DOCS_CHROME_VERSION, DOCS_REGISTRY_HOST } from "./docs-chrome";

describe("docs chrome constants", () => {
  it("matches the registry origin host", () => {
    expect(DOCS_REGISTRY_HOST).toBe(new URL(REGISTRY_ORIGIN).host);
  });

  it("matches the @diffgazer/ui package version", () => {
    expect(DOCS_CHROME_VERSION).toBe(`v${version}`);
  });
});
