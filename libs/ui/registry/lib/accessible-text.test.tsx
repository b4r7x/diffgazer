import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { hasAccessibleTextContent } from "./accessible-text";

describe("hasAccessibleTextContent", () => {
  it.each<{ expected: boolean; name: string; node: ReactNode }>([
    { name: "text", node: "Close", expected: true },
    { name: "whitespace", node: "  ", expected: false },
    { name: "number", node: 0, expected: true },
    { name: "bigint", node: 0n, expected: true },
  ])("returns $expected for $name", ({ node, expected }) => {
    expect(hasAccessibleTextContent(node)).toBe(expected);
  });

  it.each<{ name: string; node: ReactNode }>([
    { name: "hidden", node: <span hidden>Close</span> },
    { name: "aria-hidden", node: <span aria-hidden="true">Close</span> },
    { name: "display none", node: <span style={{ display: "none" }}>Close</span> },
    { name: "visibility hidden", node: <span style={{ visibility: "hidden" }}>Close</span> },
    { name: "script", node: <script type="application/json">Close</script> },
    { name: "style", node: <style>{"Close"}</style> },
    { name: "template", node: <template>Close</template> },
  ])("ignores text in $name content", ({ node }) => {
    expect(hasAccessibleTextContent(node)).toBe(false);
  });

  it("finds nested visible text among hidden siblings", () => {
    expect(
      hasAccessibleTextContent(
        <span>
          <span hidden>Hidden</span>
          <span aria-hidden="false">
            <strong>Close</strong>
          </span>
        </span>,
      ),
    ).toBe(true);
  });
});
