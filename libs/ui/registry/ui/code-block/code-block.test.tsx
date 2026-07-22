import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { codeBlockDoc } from "../../component-docs/code-block";
import { CodeBlock, type CodeBlockToken } from "./index";

const documentedTokens = [
  { text: "const", color: "var(--code-keyword)" },
  { text: " greeting", color: "var(--code-variable)" },
  { text: " = ", color: "var(--code-operator)" },
  { text: '"hello"', color: "var(--code-string)" },
] satisfies CodeBlockToken[];

describe("CodeBlock", () => {
  it("renders the documented pre-tokenized public shape", () => {
    const { container } = render(
      <CodeBlock>
        <CodeBlock.Content>
          <CodeBlock.Line content={documentedTokens} />
        </CodeBlock.Content>
      </CodeBlock>,
    );

    const code = container.querySelector("code");
    expect(code).toHaveTextContent('const greeting = "hello"');
    expect(code?.querySelectorAll("span")).toHaveLength(documentedTokens.length);
    expect(code?.firstElementChild).toHaveStyle({ color: "var(--code-keyword)" });
  });

  it("keeps Content metadata limited to the props and attributes rendered at runtime", () => {
    const { container } = render(
      <CodeBlock>
        <CodeBlock.Content>{"const value = 1;"}</CodeBlock.Content>
      </CodeBlock>,
    );

    expect(codeBlockDoc.props?.CodeBlockContent).not.toHaveProperty("tone");
    expect(codeBlockDoc.dataAttributes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ attribute: "data-tone" })]),
    );
    expect(container.querySelector('[data-slot="code-block-content"]')).not.toHaveAttribute(
      "data-tone",
    );
  });

  describe("variants", () => {
    it('defaults to data-variant="hairline"', () => {
      const { container } = render(
        <CodeBlock>
          <CodeBlock.Content>{"x"}</CodeBlock.Content>
        </CodeBlock>,
      );

      const figure = container.querySelector('[data-slot="code-block"]');
      expect(figure).toHaveAttribute("data-variant", "hairline");
    });

    it('suppresses the header element in variant="bare"', () => {
      const { container } = render(
        <CodeBlock variant="bare">
          <CodeBlock.Header>
            <CodeBlock.Label>hidden.tsx</CodeBlock.Label>
          </CodeBlock.Header>
          <CodeBlock.Content>{"x"}</CodeBlock.Content>
        </CodeBlock>,
      );

      expect(container.querySelector('[data-slot="code-block-header"]')).toBeNull();
    });

    it('renders three aria-hidden dots in variant="terminal"', () => {
      const { container } = render(
        <CodeBlock variant="terminal">
          <CodeBlock.Header>
            <CodeBlock.Label>~/diffgazer</CodeBlock.Label>
          </CodeBlock.Header>
          <CodeBlock.Content>{"$ ls"}</CodeBlock.Content>
        </CodeBlock>,
      );

      const dots = container.querySelector('[data-slot="code-block-dots"]');
      expect(dots).not.toBeNull();
      expect(dots).toHaveAttribute("aria-hidden", "true");
      expect(dots?.querySelectorAll("span").length).toBe(3);
      expect(container.querySelector('[data-slot="code-block"]')).toHaveAttribute(
        "data-chrome",
        "dots",
      );
    });

    it('omits dots in variant="terminal" when chrome="none"', () => {
      const { container } = render(
        <CodeBlock variant="terminal" chrome="none">
          <CodeBlock.Header>
            <CodeBlock.Label>~/diffgazer</CodeBlock.Label>
          </CodeBlock.Header>
          <CodeBlock.Content>{"$ ls"}</CodeBlock.Content>
        </CodeBlock>,
      );

      expect(container.querySelector('[data-slot="code-block-dots"]')).toBeNull();
      expect(container.querySelector('[data-slot="code-block"]')).toHaveAttribute(
        "data-chrome",
        "none",
      );
    });

    it('explicit chrome="dots" matches the default for variant="terminal"', () => {
      const { container } = render(
        <>
          <CodeBlock variant="terminal">
            <CodeBlock.Header>
              <CodeBlock.Label>~/a</CodeBlock.Label>
            </CodeBlock.Header>
            <CodeBlock.Content>{"$ pwd"}</CodeBlock.Content>
          </CodeBlock>
          <CodeBlock variant="terminal" chrome="dots">
            <CodeBlock.Header>
              <CodeBlock.Label>~/a</CodeBlock.Label>
            </CodeBlock.Header>
            <CodeBlock.Content>{"$ pwd"}</CodeBlock.Content>
          </CodeBlock>
        </>,
      );

      const [implicit, explicit] = container.querySelectorAll('[data-slot="code-block"]');
      expect(implicit).toHaveAttribute("data-chrome", "dots");
      expect(explicit).toHaveAttribute("data-chrome", "dots");

      const implicitDots = implicit?.querySelector('[data-slot="code-block-dots"]');
      const explicitDots = explicit?.querySelector('[data-slot="code-block-dots"]');
      expect(implicitDots).not.toBeNull();
      expect(explicitDots).not.toBeNull();
      expect(implicitDots?.querySelectorAll("span").length).toBe(3);
      expect(explicitDots?.querySelectorAll("span").length).toBe(3);
    });

    it('propagates chrome="dots" via data-chrome regardless of variant', () => {
      const { container } = render(
        <CodeBlock variant="hairline" chrome="dots">
          <CodeBlock.Header>
            <CodeBlock.Label>file.tsx</CodeBlock.Label>
          </CodeBlock.Header>
          <CodeBlock.Content>{"const x = 1"}</CodeBlock.Content>
        </CodeBlock>,
      );

      const figure = container.querySelector('[data-slot="code-block"]');
      expect(figure).toHaveAttribute("data-variant", "hairline");
      expect(figure).toHaveAttribute("data-chrome", "dots");
      expect(figure?.querySelector('[data-slot="code-block-header"]')).not.toBeNull();
      expect(figure?.querySelector('[data-slot="code-block-dots"]')).not.toBeNull();
    });
  });

  describe("line states", () => {
    it('renders data-line-state="added" and a sr-only "Added: " prefix', () => {
      const { container } = render(
        <CodeBlock>
          <CodeBlock.Content>
            <CodeBlock.Line number={1} content="new line" state="added" />
          </CodeBlock.Content>
        </CodeBlock>,
      );

      const line = container.querySelector('[data-slot="code-block-line"]');
      expect(line).toHaveAttribute("data-line-state", "added");
      expect(within(line as HTMLElement).getByText(/^Added:$/)).toBeInTheDocument();
    });

    it('renders data-line-state="removed" and a sr-only "Removed: " prefix', () => {
      const { container } = render(
        <CodeBlock>
          <CodeBlock.Content>
            <CodeBlock.Line number={1} content="old line" state="removed" />
          </CodeBlock.Content>
        </CodeBlock>,
      );

      const line = container.querySelector('[data-slot="code-block-line"]');
      expect(line).toHaveAttribute("data-line-state", "removed");
      expect(within(line as HTMLElement).getByText(/^Removed:$/)).toBeInTheDocument();
    });
  });

  describe("content scrolling", () => {
    it("scrolls the named content region horizontally and vertically once focused", async () => {
      const user = userEvent.setup();
      render(
        <CodeBlock label="big-file.ts">
          <CodeBlock.Content>
            {"a very long line of code that overflows the visible width of the region"}
          </CodeBlock.Content>
        </CodeBlock>,
      );

      const content = screen.getByRole("region", { name: "big-file.ts" });
      Object.defineProperty(content, "clientWidth", { value: 100, configurable: true });
      Object.defineProperty(content, "scrollWidth", { value: 1000, configurable: true });
      Object.defineProperty(content, "clientHeight", { value: 100, configurable: true });
      Object.defineProperty(content, "scrollHeight", { value: 1000, configurable: true });

      await user.click(content);
      await user.keyboard("{ArrowRight}");
      expect(content.scrollLeft).toBe(40);

      await user.keyboard("{ArrowDown}");
      expect(content.scrollTop).toBe(40);
    });
  });

  describe("orphan context", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it("throws when CodeBlock.Header is rendered outside <CodeBlock>", () => {
      expect(() => render(<CodeBlock.Header />)).toThrow(/CodeBlock/);
    });

    it("throws when CodeBlock.Label is rendered outside <CodeBlock>", () => {
      expect(() => render(<CodeBlock.Label>x</CodeBlock.Label>)).toThrow(/CodeBlock/);
    });

    it("throws when CodeBlock.Content is rendered outside <CodeBlock>", () => {
      expect(() => render(<CodeBlock.Content>{"x"}</CodeBlock.Content>)).toThrow(/CodeBlock/);
    });
  });
});
