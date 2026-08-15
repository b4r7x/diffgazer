// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("composeRefs documentation recipes", () => {
  it("keeps component render examples on useComposedRefs", () => {
    const markdown = readFileSync(
      resolve(import.meta.dirname, "../../../docs/content/utils/compose-refs.mdx"),
      "utf8",
    );
    const tsxFences = [...markdown.matchAll(/```tsx\n([\s\S]*?)```/g)].flatMap((match) =>
      match[1] ? [match[1]] : [],
    );

    expect(tsxFences).not.toHaveLength(0);
    expect(tsxFences.some((fence) => fence.includes("useComposedRefs("))).toBe(true);
    // Strip the hook first so only a bare composeRefs( call is left to catch,
    // whatever the recipe names the variable it assigns.
    expect(tsxFences.join("\n").replaceAll("useComposedRefs(", "")).not.toContain("composeRefs(");
  });
});
