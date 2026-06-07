import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { common, createLowlight } from "lowlight";
import type { MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireElement } from "../../testing/assertions";
import { CodeBlockHighlight, createDefaultLowlight } from "./highlight";
import { CodeBlock } from "./index";

const lowlight = createLowlight(common);

describe("CodeBlock", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("accessible name", () => {
    it("uses an explicit aria-label when provided", () => {
      render(
        <CodeBlock aria-label="Custom name">
          <CodeBlock.Content>{"x"}</CodeBlock.Content>
        </CodeBlock>,
      );

      expect(screen.getByLabelText("Custom name")).toBeInTheDocument();
    });

    it("uses an explicit aria-labelledby when provided", () => {
      render(
        <>
          <h2 id="external">External title</h2>
          <CodeBlock aria-labelledby="external">
            <CodeBlock.Content>{"x"}</CodeBlock.Content>
          </CodeBlock>
        </>,
      );

      expect(screen.getByLabelText("External title")).toBeInTheDocument();
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

    it('falls back to "<language> code" when no label is supplied', () => {
      const { container } = render(
        <CodeBlock language="ts">
          <CodeBlock.Content>{"x"}</CodeBlock.Content>
        </CodeBlock>,
      );

      const figure = container.querySelector('[data-slot="code-block"]');
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

    it('renders dots on a non-terminal variant when chrome="dots"', () => {
      const { container } = render(
        <CodeBlock variant="hairline" chrome="dots">
          <CodeBlock.Header>
            <CodeBlock.Label>file.tsx</CodeBlock.Label>
          </CodeBlock.Header>
          <CodeBlock.Content>{"const x = 1"}</CodeBlock.Content>
        </CodeBlock>,
      );

      expect(container.querySelector('[data-slot="code-block-dots"]')).not.toBeNull();
      expect(container.querySelector('[data-slot="code-block"]')).toHaveAttribute(
        "data-chrome",
        "dots",
      );
    });

    it('explicit chrome="dots" matches the default for variant="terminal"', () => {
      const { container } = render(
        <>
          <CodeBlock variant="terminal" data-testid="implicit">
            <CodeBlock.Header>
              <CodeBlock.Label>~/a</CodeBlock.Label>
            </CodeBlock.Header>
            <CodeBlock.Content>{"$ pwd"}</CodeBlock.Content>
          </CodeBlock>
          <CodeBlock variant="terminal" chrome="dots" data-testid="explicit">
            <CodeBlock.Header>
              <CodeBlock.Label>~/a</CodeBlock.Label>
            </CodeBlock.Header>
            <CodeBlock.Content>{"$ pwd"}</CodeBlock.Content>
          </CodeBlock>
        </>,
      );

      const implicit = container.querySelector('[data-testid="implicit"]');
      const explicit = container.querySelector('[data-testid="explicit"]');
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
      // jsdom does not compute CSS, so we assert the DOM contract that the
      // shared/code-block.css selector targets: the figure carries
      // data-chrome="dots" on a non-terminal variant, which is the public
      // hook the chrome styles attach to.
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
      expect(within(line as HTMLElement).getByText(/^Added:$/)).toHaveClass("sr-only");
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
      expect(within(line as HTMLElement).getByText(/^Removed:$/)).toHaveClass("sr-only");
    });
  });

  describe("copy button", () => {
    let writeText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { ...globalThis.navigator, clipboard: { writeText } });
    });

    it("writes the source to the clipboard on click", async () => {
      render(
        <CodeBlock>
          <CodeBlock.Header>
            <CodeBlock.CopyButton source="hello world" />
          </CodeBlock.Header>
          <CodeBlock.Content>{"hello world"}</CodeBlock.Content>
        </CodeBlock>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith("hello world"));
    });

    it('toggles data-state to "copied" and announces via aria-live', async () => {
      const { container } = render(
        <CodeBlock>
          <CodeBlock.Header>
            <CodeBlock.CopyButton source="x" />
          </CodeBlock.Header>
          <CodeBlock.Content>{"x"}</CodeBlock.Content>
        </CodeBlock>,
      );

      const button = screen.getByRole("button", { name: "Copy code to clipboard" });
      expect(button).toHaveAttribute("data-state", "idle");

      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "copied");
      });

      const live = container.querySelector('[aria-live="polite"]');
      expect(live?.textContent).toBe("Copied");
    });

    it("calls onCopy with the source after a successful write", async () => {
      const onCopy = vi.fn();
      render(
        <CodeBlock>
          <CodeBlock.Header>
            <CodeBlock.CopyButton source="hi" onCopy={onCopy} />
          </CodeBlock.Header>
          <CodeBlock.Content>{"hi"}</CodeBlock.Content>
        </CodeBlock>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

      await waitFor(() => expect(onCopy).toHaveBeenCalledWith("hi"));
    });

    it("calls onCopyError when writeText rejects", async () => {
      const failure = new Error("denied");
      writeText.mockRejectedValueOnce(failure);
      const onCopyError = vi.fn();
      render(
        <CodeBlock>
          <CodeBlock.Header>
            <CodeBlock.CopyButton source="hi" onCopyError={onCopyError} />
          </CodeBlock.Header>
          <CodeBlock.Content>{"hi"}</CodeBlock.Content>
        </CodeBlock>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

      await waitFor(() => expect(onCopyError).toHaveBeenCalledWith(failure));
    });

    it("calls onCopyError when navigator.clipboard is absent", async () => {
      vi.stubGlobal("navigator", { ...globalThis.navigator, clipboard: undefined });
      const onCopyError = vi.fn();
      render(
        <CodeBlock>
          <CodeBlock.Header>
            <CodeBlock.CopyButton source="hi" onCopyError={onCopyError} />
          </CodeBlock.Header>
          <CodeBlock.Content>{"hi"}</CodeBlock.Content>
        </CodeBlock>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

      await waitFor(() => expect(onCopyError).toHaveBeenCalledTimes(1));
      expect(onCopyError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    });

    it("short-circuits when a consumer onClick calls preventDefault", () => {
      const onClick = vi.fn((event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
      });
      render(
        <CodeBlock>
          <CodeBlock.Header>
            <CodeBlock.CopyButton source="hi" onClick={onClick} />
          </CodeBlock.Header>
          <CodeBlock.Content>{"hi"}</CodeBlock.Content>
        </CodeBlock>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(writeText).not.toHaveBeenCalled();
    });

    it('returns to data-state="idle" after the 2s timeout', async () => {
      vi.useFakeTimers();
      try {
        const { container } = render(
          <CodeBlock>
            <CodeBlock.Header>
              <CodeBlock.CopyButton source="x" />
            </CodeBlock.Header>
            <CodeBlock.Content>{"x"}</CodeBlock.Content>
          </CodeBlock>,
        );

        const button = screen.getByRole("button", { name: "Copy code to clipboard" });
        await act(async () => {
          fireEvent.click(button);
          await Promise.resolve();
        });

        expect(button).toHaveAttribute("data-state", "copied");

        await act(async () => {
          vi.advanceTimersByTime(2000);
        });

        expect(button).toHaveAttribute("data-state", "idle");
        const live = container.querySelector('[aria-live="polite"]');
        expect(live?.textContent).toBe("");
      } finally {
        vi.useRealTimers();
      }
    });

    it("invokes children as a render prop with { copied }", async () => {
      render(
        <CodeBlock>
          <CodeBlock.Header>
            <CodeBlock.CopyButton source="hi">
              {(state) => <span>{state === "copied" ? "Done" : "Go"}</span>}
            </CodeBlock.CopyButton>
          </CodeBlock.Header>
          <CodeBlock.Content>{"hi"}</CodeBlock.Content>
        </CodeBlock>,
      );

      const button = screen.getByRole("button", { name: "Copy code to clipboard" });
      expect(button).toHaveTextContent("Go");

      fireEvent.click(button);

      await waitFor(() => expect(button).toHaveTextContent("Done"));
    });
  });

  // jsdom does not compute syntax-highlight colors, so highlighting is verified
  // by its observable DOM effect: lowlight splits a line's source into token
  // <span> elements inside <code>, whereas plain text stays a single text node.
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

    it("renders source as plain text when no lowlight instance is provided", () => {
      render(
        <CodeBlock language="ts">
          <CodeBlockHighlight code="const x = 1" language="typescript" />
        </CodeBlock>,
      );

      const line = requireElement(
        document.querySelector('[data-slot="code-block-line"]'),
        "plain code line",
      );
      expect(codeTokenCount(line)).toBe(0);
      expect(line.querySelector("code")).toHaveTextContent("const x = 1");
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
      // Highlighting still tokenizes the code on diff-state rows.
      expect(codeTokenCount(requireElement(lines[0], "added diff line"))).toBeGreaterThan(0);
      expect(codeTokenCount(requireElement(lines[1], "removed diff line"))).toBeGreaterThan(0);
    });

    it("createDefaultLowlight() loads lowlight lazily and returns a usable instance", async () => {
      const instance = await createDefaultLowlight();
      expect(typeof instance.highlight).toBe("function");
      expect(typeof instance.highlightAuto).toBe("function");
      const tree = instance.highlight("typescript", "const x = 1");
      expect(tree.children.length).toBeGreaterThan(0);
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
});
