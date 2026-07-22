// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("composeRefs documentation recipes", () => {
  it("keeps component render examples on useComposedRefs", () => {
    const markdown = readFileSync(
      resolve(process.cwd(), "docs/content/utils/compose-refs.mdx"),
      "utf8",
    );
    const tsxFences = [...markdown.matchAll(/```tsx\n([\s\S]*?)```/g)].flatMap((match) =>
      match[1] ? [match[1]] : [],
    );

    expect(tsxFences).not.toHaveLength(0);
    expect(tsxFences.join("\n")).not.toContain("const composedRef = composeRefs(");
    expect(
      tsxFences.filter((fence) => fence.includes("const composedRef = useComposedRefs(")),
    ).toHaveLength(3);
  });
});
