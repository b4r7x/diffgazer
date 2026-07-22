import { render } from "@testing-library/react";
import { common, createLowlight } from "lowlight";
import { describe, expect, it } from "vitest";
import CodeBlockHighlighted from "../../examples/code-block/code-block-highlighted";
import { requireElement } from "../../testing/assertions";
import * as highlightEntry from "./highlight";
import { CodeBlockHighlight } from "./highlight";
import { CodeBlock } from "./index";

const lowlight = createLowlight(common);

// lowlight splits highlighted source into token <span>s inside <code>.
function codeTokenCount(line: Element): number {
  return line.querySelector("code")?.querySelectorAll("span").length ?? 0;
}

describe("highlight", () => {
  it("tokenizes source into styled spans when a lowlight instance is provided", () => {
    render(
      <CodeBlock language="ts">
        <CodeBlockHighlight code="const x = 1" language="typescript" lowlight={lowlight} />
      </CodeBlock>,
    );

    const line = requireElement(
      document.querySelector('[data-slot="code-block-line"]'),
      "highlighted code line",
    );
    expect(codeTokenCount(line)).toBeGreaterThan(0);
    expect(line.querySelector("code")).toHaveTextContent("const x = 1");
  });

  it("tokenizes multi-line constructs across line boundaries", () => {
    const { container } = render(
      <CodeBlock language="ts">
        <CodeBlockHighlight
          code={"/* starts here\ncontinues here */"}
          language="typescript"
          lowlight={lowlight}
        />
      </CodeBlock>,
    );

    const lines = container.querySelectorAll('[data-slot="code-block-line"]');
    const secondLine = requireElement(lines[1], "second highlighted code line");
    const commentTokens = Array.from(secondLine.querySelectorAll("code span")).filter((span) =>
      span.className.split(/\s+/).includes("hljs-comment"),
    );

    expect(lines).toHaveLength(2);
    expect(secondLine.querySelector("code")).toHaveTextContent("continues here */");
    expect(commentTokens.length).toBeGreaterThan(0);
  });

  it("applies lineStates, gutter signs, and tokenized highlighting together on diff rows", () => {
    const { container } = render(
      <CodeBlock language="ts">
        <CodeBlockHighlight
          code={"const a = 1\nconst b = 2"}
          language="typescript"
          lineStates={{ 1: "added", 2: "removed" }}
          lowlight={lowlight}
        />
      </CodeBlock>,
    );

    const lines = container.querySelectorAll('[data-slot="code-block-line"]');
    expect(lines[0]).toHaveAttribute("data-line-state", "added");
    expect(lines[1]).toHaveAttribute("data-line-state", "removed");
    expect(lines[0]?.querySelector('[data-slot="code-block-line-sign"]')?.textContent).toBe("+");
    expect(lines[1]?.querySelector('[data-slot="code-block-line-sign"]')?.textContent).toBe("−");
    expect(codeTokenCount(requireElement(lines[0], "added diff line"))).toBeGreaterThan(0);
    expect(codeTokenCount(requireElement(lines[1], "removed diff line"))).toBeGreaterThan(0);
  });

  it("requires lowlight through the actual public highlighted example", () => {
    const { container } = render(<CodeBlockHighlighted />);
    const lines = container.querySelectorAll('[data-slot="code-block-line"]');

    expect(lines.length).toBeGreaterThan(1);
    expect(Array.from(lines).some((line) => line.querySelectorAll("code span").length > 0)).toBe(
      true,
    );
    expect(container).toHaveTextContent("export function Counter");
    expect("createDefaultLowlight" in highlightEntry).toBe(false);
  });
});
