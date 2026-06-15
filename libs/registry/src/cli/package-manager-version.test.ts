import { describe, expect, it } from "vitest";
import { normalizeVersionSpec } from "./package-manager.js";

describe("normalizeVersionSpec", () => {
  it.each([
    "^0.2.0",
    "latest",
    "0.3.1",
    "workspace:*",
  ])("accepts valid version spec: %s", (spec) => {
    expect(normalizeVersionSpec(spec, "@diffgazer/keys")).toBe(spec);
  });

  it.each([
    "link:../keys",
    "file:../keys",
    "npm:alias@^1.0.0",
  ])("rejects protocol or alias version specs: %s", (spec) => {
    expect(() => normalizeVersionSpec(spec, "@diffgazer/keys")).toThrow(
      /Protocol or alias sources are not allowed/,
    );
  });
});
