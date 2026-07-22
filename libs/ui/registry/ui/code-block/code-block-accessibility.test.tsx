import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { CodeBlock } from "./index";

describe("accessible name", () => {
  it("uses an explicit aria-label when provided", () => {
    render(
      <CodeBlock aria-label="Custom name">
        <CodeBlock.Content>{"x"}</CodeBlock.Content>
      </CodeBlock>,
    );

    expect(screen.getAllByLabelText("Custom name")).toHaveLength(2);
  });

  it("derives the accessible name from a rendered CodeBlock.Label", () => {
    const { container } = render(
      <CodeBlock>
        <CodeBlock.Header>
          <CodeBlock.Label>app.tsx</CodeBlock.Label>
        </CodeBlock.Header>
        <CodeBlock.Content>{"x"}</CodeBlock.Content>
      </CodeBlock>,
    );

    const figure = container.querySelector('[data-slot="code-block"]');
    const label = container.querySelector('[data-slot="code-block-label"]');
    expect(figure).toHaveAttribute("aria-labelledby", label?.id);
    expect(figure).not.toHaveAttribute("aria-label");
    expect(label).toHaveTextContent("app.tsx");
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "aria-labelledby",
      label?.id,
    );
  });

  it("falls back instead of referencing a Label suppressed by a bare Header", () => {
    const { container } = render(
      <CodeBlock variant="bare" language="ts">
        <CodeBlock.Header>
          <CodeBlock.Label>hidden.tsx</CodeBlock.Label>
        </CodeBlock.Header>
        <CodeBlock.Content>{"x"}</CodeBlock.Content>
      </CodeBlock>,
    );

    const figure = container.querySelector('[data-slot="code-block"]');
    const content = container.querySelector('[data-slot="scroll-area"]');
    expect(container.querySelector('[data-slot="code-block-label"]')).toBeNull();
    expect(figure).toHaveAttribute("aria-label", "ts code");
    expect(figure).not.toHaveAttribute("aria-labelledby");
    expect(content).toHaveAttribute("aria-label", "ts code");
    expect(content).not.toHaveAttribute("aria-labelledby");
  });

  it("coordinates a custom Label id with the figure and scroll region", () => {
    const { container } = render(
      <CodeBlock>
        <CodeBlock.Header>
          <CodeBlock.Label id="consumer-label">custom.tsx</CodeBlock.Label>
        </CodeBlock.Header>
        <CodeBlock.Content>{"x"}</CodeBlock.Content>
      </CodeBlock>,
    );

    expect(container.querySelector('[data-slot="code-block"]')).toHaveAttribute(
      "aria-labelledby",
      "consumer-label",
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "aria-labelledby",
      "consumer-label",
    );
  });

  it("gives implicit labels unique ids and falls back to the next mounted label", () => {
    function Labels({ showFirst }: { showFirst: boolean }) {
      return (
        <CodeBlock>
          <CodeBlock.Header>
            {showFirst ? <CodeBlock.Label key="first">first.ts</CodeBlock.Label> : null}
            <CodeBlock.Label key="second">second.ts</CodeBlock.Label>
          </CodeBlock.Header>
          <CodeBlock.Content>{"x"}</CodeBlock.Content>
        </CodeBlock>
      );
    }

    const { container, rerender } = render(<Labels showFirst />);
    const labels = container.querySelectorAll('[data-slot="code-block-label"]');
    const firstId = labels[0]?.id;
    const secondId = labels[1]?.id;

    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);
    expect(container.querySelector('[data-slot="code-block"]')).toHaveAttribute(
      "aria-labelledby",
      firstId,
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "aria-labelledby",
      firstId,
    );

    rerender(<Labels showFirst={false} />);

    expect(container.querySelector('[data-slot="code-block"]')).toHaveAttribute(
      "aria-labelledby",
      secondId,
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "aria-labelledby",
      secondId,
    );

    rerender(<Labels showFirst />);

    expect(container.querySelector('[data-slot="code-block"]')).toHaveAttribute(
      "aria-labelledby",
      secondId,
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "aria-labelledby",
      secondId,
    );
  });

  it("keeps a duplicate custom id registered until its final label unmounts", () => {
    function Labels({ showFirst }: { showFirst: boolean }) {
      return (
        <CodeBlock>
          <CodeBlock.Header>
            {showFirst ? (
              <CodeBlock.Label key="first" id="shared-label">
                first.ts
              </CodeBlock.Label>
            ) : null}
            <CodeBlock.Label key="second" id="shared-label">
              second.ts
            </CodeBlock.Label>
          </CodeBlock.Header>
          <CodeBlock.Content>{"x"}</CodeBlock.Content>
        </CodeBlock>
      );
    }

    const { container, rerender } = render(<Labels showFirst />);
    rerender(<Labels showFirst={false} />);

    expect(container.querySelectorAll("#shared-label")).toHaveLength(1);
    expect(container.querySelector('[data-slot="code-block"]')).toHaveAttribute(
      "aria-labelledby",
      "shared-label",
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "aria-labelledby",
      "shared-label",
    );
  });

  it("provides the root's explicit aria-label to the scroll region", () => {
    const { container } = render(
      <CodeBlock aria-label="Server output">
        <CodeBlock.Header>
          <CodeBlock.Label>ignored-for-naming.txt</CodeBlock.Label>
        </CodeBlock.Header>
        <CodeBlock.Content>{"x"}</CodeBlock.Content>
      </CodeBlock>,
    );

    expect(container.querySelector('[data-slot="code-block"]')).toHaveAttribute(
      "aria-label",
      "Server output",
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "aria-label",
      "Server output",
    );
  });

  it("provides the root's explicit aria-labelledby to the scroll region", () => {
    const { container } = render(
      <>
        <h2 id="external-code-title">External code title</h2>
        <CodeBlock aria-labelledby="external-code-title">
          <CodeBlock.Content>{"x"}</CodeBlock.Content>
        </CodeBlock>
      </>,
    );

    expect(container.querySelector('[data-slot="code-block"]')).toHaveAttribute(
      "aria-labelledby",
      "external-code-title",
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "aria-labelledby",
      "external-code-title",
    );
    expect(screen.getAllByLabelText("External code title")).toHaveLength(2);
  });

  it("does not set aria-labelledby when no Label is rendered", () => {
    const { container } = render(
      <CodeBlock language="ts">
        <CodeBlock.Content>{"x"}</CodeBlock.Content>
      </CodeBlock>,
    );

    const figure = container.querySelector('[data-slot="code-block"]');
    expect(figure).not.toHaveAttribute("aria-labelledby");
    expect(figure).toHaveAttribute("aria-label", "ts code");
  });

  it('falls back to "Code block" when neither label nor language is set', () => {
    const { container } = render(
      <CodeBlock>
        <CodeBlock.Content>{"x"}</CodeBlock.Content>
      </CodeBlock>,
    );

    const figure = container.querySelector('[data-slot="code-block"]');
    expect(figure).toHaveAttribute("aria-label", "Code block");
  });

  it("uses the `label` prop when no Label child is rendered", () => {
    const { container } = render(
      <CodeBlock label="My snippet">
        <CodeBlock.Content>{"x"}</CodeBlock.Content>
      </CodeBlock>,
    );

    const figure = container.querySelector('[data-slot="code-block"]');
    expect(figure).toHaveAttribute("aria-label", "My snippet");
  });
});

it("has no a11y violations across variants", async () => {
  for (const variant of ["hairline", "bare", "terminal"] as const) {
    const { container, unmount } = render(
      <CodeBlock variant={variant} language="ts">
        <CodeBlock.Header>
          <CodeBlock.Label>{`${variant}.ts`}</CodeBlock.Label>
        </CodeBlock.Header>
        <CodeBlock.Content>{"const value = 1"}</CodeBlock.Content>
      </CodeBlock>,
    );

    expect(await axe(container)).toHaveNoViolations();
    unmount();
  }
});
