import { describe, expect, it } from "vitest";
import { parseRegistryDependencyRef } from "../cli/registry.js";

describe("parseRegistryDependencyRef", () => {
  it("parses local refs", () => {
    expect(parseRegistryDependencyRef("button")).toEqual({
      kind: "local",
      raw: "button",
      name: "button",
    });
  });

  it("parses simple namespace refs", () => {
    expect(parseRegistryDependencyRef("@ui/button")).toEqual({
      kind: "namespace",
      raw: "@ui/button",
      namespace: "@ui",
      name: "button",
    });
  });

  it("parses scoped package namespace refs", () => {
    expect(parseRegistryDependencyRef("@diffgazer/keys/navigation")).toEqual({
      kind: "namespace",
      raw: "@diffgazer/keys/navigation",
      namespace: "@diffgazer/keys",
      name: "navigation",
    });
  });
});
