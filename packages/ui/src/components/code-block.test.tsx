import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CodeBlock } from "./code-block";

describe("CodeBlock", () => {
  it("wraps code content in a horizontal ScrollArea", () => {
    const html = renderToStaticMarkup(
      <CodeBlock
        lines={[
          {
            number: 1,
            content: "const veryLongLine = 'x'.repeat(300);",
          },
        ]}
      />,
    );

    expect(html).toContain("scrollbar-thin");
    expect(html).toContain("overflow-x-auto");
  });
});
