import { describe, expect, it } from "vitest";
import { findOrphanedNpmDeps } from "../cli/workflows/remove.js";

interface TestItem {
  name: string;
  dependencies: string[];
}

describe("findOrphanedNpmDeps", () => {
  const items: TestItem[] = [
    { name: "select", dependencies: ["@diffgazer/keys", "clsx"] },
    { name: "button", dependencies: ["clsx"] },
  ];

  it("reports orphaned @diffgazer/keys when the last consumer is removed", () => {
    const orphaned = findOrphanedNpmDeps({
      removedNames: ["select"],
      getAllItems: () => items,
      getItemName: (item) => item.name,
      getItemDeps: (item) => item.dependencies,
      isInstalled: (item) => item.name === "button",
    });

    expect(orphaned).toContain("@diffgazer/keys");
    expect(orphaned).not.toContain("clsx");
  });

  it("does not report deps still required by retained installed items", () => {
    const orphaned = findOrphanedNpmDeps({
      removedNames: ["button"],
      getAllItems: () => items,
      getItemName: (item) => item.name,
      getItemDeps: (item) => item.dependencies,
      isInstalled: (item) => item.name === "select",
    });

    expect(orphaned).not.toContain("clsx");
    expect(orphaned).not.toContain("@diffgazer/keys");
  });
});
