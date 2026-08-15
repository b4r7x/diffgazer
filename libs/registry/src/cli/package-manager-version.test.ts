import { describe, expect, it } from "vitest";
import { normalizeVersionSpec, validateDependencyProtocol } from "./package-manager.js";

describe("normalizeVersionSpec", () => {
  it.each([
    "^0.2.0",
    "latest",
    "0.3.1",
    ">=1.0.0 <2.0.0",
  ])("accepts valid version spec: %s", (spec) => {
    expect(normalizeVersionSpec(spec, "@diffgazer/keys")).toBe(spec);
    expect(() => validateDependencyProtocol(`@diffgazer/keys@${spec}`)).not.toThrow();
  });

  it.each([
    "catalog:default",
    "patch:@diffgazer/keys@1.0.0",
    "portal:../keys",
  ])("rejects protocol sources the dependency validator also rejects: %s", (spec) => {
    expect(() => normalizeVersionSpec(spec, "@diffgazer/keys")).toThrow(
      /Use a semver, range, or dist tag/,
    );
    expect(() => validateDependencyProtocol(`@diffgazer/keys@${spec}`)).toThrow();
  });

  it("rejects workspace protocol version specs", () => {
    expect(() => normalizeVersionSpec("workspace:*", "@diffgazer/keys")).toThrow(
      /Workspace protocol sources are not allowed/,
    );
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
