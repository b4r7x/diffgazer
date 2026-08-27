import { describe, expect, it } from "vitest";
import { deriveUiRegistryTarget } from "./ui-registry-targets.js";

describe("deriveUiRegistryTarget", () => {
  it("pins @ui/ targets for registry:ui files", () => {
    expect(
      deriveUiRegistryTarget({
        type: "registry:ui",
        path: "registry/ui/sidebar/sidebar.tsx",
      }),
    ).toBe("@ui/sidebar/sidebar.tsx");
  });

  it("pins @lib/ targets for nested registry:lib subtrees", () => {
    expect(
      deriveUiRegistryTarget({
        type: "registry:lib",
        path: "registry/lib/diff/index.ts",
      }),
    ).toBe("@lib/diff/index.ts");
    expect(
      deriveUiRegistryTarget({
        type: "registry:lib",
        path: "registry/lib/diff/parse.ts",
      }),
    ).toBe("@lib/diff/parse.ts");
  });

  it("leaves flat registry:lib files target-free", () => {
    expect(
      deriveUiRegistryTarget({
        type: "registry:lib",
        path: "registry/lib/utils.ts",
      }),
    ).toBeUndefined();
  });

  it("pins @hooks/ targets for nested registry:hook subtrees", () => {
    expect(
      deriveUiRegistryTarget({
        type: "registry:hook",
        path: "registry/hooks/nested/use-example.ts",
      }),
    ).toBe("@hooks/nested/use-example.ts");
  });

  it("leaves flat registry:hook files target-free", () => {
    expect(
      deriveUiRegistryTarget({
        type: "registry:hook",
        path: "registry/hooks/use-listbox.ts",
      }),
    ).toBeUndefined();
  });
});
