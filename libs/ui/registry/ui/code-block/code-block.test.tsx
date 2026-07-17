import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { common, createLowlight } from "lowlight";
import type { MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { codeBlockDoc } from "../../component-docs/code-block";
import CodeBlockHighlighted from "../../examples/code-block/code-block-highlighted";
import { requireElement } from "../../testing/assertions";
import * as highlightEntry from "./highlight";
import { CodeBlockHighlight } from "./highlight";
import { CodeBlock, type CodeBlockToken } from "./index";

const lowlight = createLowlight(common);
const documentedTokens = [
  { text: "const", color: "var(--code-keyword)" },
  { text: " greeting", color: "var(--code-variable)" },
  { text: " = ", color: "var(--code-operator)" },
  { text: '"hello"', color: "var(--code-string)" },
] satisfies CodeBlockToken[];

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

function createDeferred(): Deferred {
  let resolve: () => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("CodeBlock", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  describe("accessible name", () => {
    it("uses an explicit aria-label when provided", () => {
      render(
        <CodeBlock aria-label="Custom name">
          <CodeBlock.Content>{"x"}</CodeBlock.Content>
        </CodeBlock>,
      );

      expect(screen.getAllByLabelText("Custom name")).toHaveLength(2);
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

      expect(screen.getAllByLabelText("External title")).toHaveLength(2);
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

  describe("copy button", () => {
    let writeText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { ...globalThis.navigator, clipboard: { writeText } });
    });

    function setupClipboardUser(options?: Parameters<typeof userEvent.setup>[0]) {
      const user = userEvent.setup(options);
      vi.stubGlobal("navigator", { ...globalThis.navigator, clipboard: { writeText } });
      return user;
    }

    it("writes the source to the clipboard on click", async () => {
      const user = setupClipboardUser();
      render(
        <CodeBlock>
          <CodeBlock.Header>
            <CodeBlock.CopyButton source="hello world" />
          </CodeBlock.Header>
          <CodeBlock.Content>{"hello world"}</CodeBlock.Content>
        </CodeBlock>,
      );

      await user.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith("hello world"));
    });

    it('toggles data-state to "copied" and announces via aria-live', async () => {
      const user = setupClipboardUser();
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

      await user.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "copied");
      });

      const live = container.querySelector('[aria-live="polite"]');
      expect(live?.textContent).toBe("Copied");
    });

    it("calls onCopy with the source after a successful write", async () => {
      const user = setupClipboardUser();
      const onCopy = vi.fn();
      render(
        <CodeBlock>
          <CodeBlock.Header>
            <CodeBlock.CopyButton source="hi" onCopy={onCopy} />
          </CodeBlock.Header>
          <CodeBlock.Content>{"hi"}</CodeBlock.Content>
        </CodeBlock>,
      );

      await user.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

      await waitFor(() => expect(onCopy).toHaveBeenCalledWith("hi"));
    });

    it("calls onCopyError when writeText rejects", async () => {
      const user = setupClipboardUser();
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

      await user.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

      await waitFor(() => expect(onCopyError).toHaveBeenCalledWith(failure));
    });

    it("calls onCopyError when navigator.clipboard is absent", async () => {
      const user = setupClipboardUser();
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

      await user.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

      await waitFor(() => expect(onCopyError).toHaveBeenCalledTimes(1));
      expect(onCopyError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    });

    it("short-circuits when a consumer onClick calls preventDefault", async () => {
      const user = setupClipboardUser();
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

      await user.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(writeText).not.toHaveBeenCalled();
    });

    it('returns to data-state="idle" after the 2s timeout', async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        const user = setupClipboardUser({
          advanceTimers: (delay) => {
            vi.advanceTimersByTime(delay);
          },
          delay: null,
          skipHover: true,
        });
        const { container } = render(
          <CodeBlock>
            <CodeBlock.Header>
              <CodeBlock.CopyButton source="x" />
            </CodeBlock.Header>
            <CodeBlock.Content>{"x"}</CodeBlock.Content>
          </CodeBlock>,
        );

        const button = screen.getByRole("button", { name: "Copy code to clipboard" });
        const click = user.click(button);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        await click;

        expect(button).toHaveAttribute("data-state", "copied");

        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });

        expect(button).toHaveAttribute("data-state", "idle");
        const live = container.querySelector('[aria-live="polite"]');
        expect(live?.textContent).toBe("");
      } finally {
        vi.useRealTimers();
      }
    });

    it("invokes children as a render prop with { copied }", async () => {
      const user = setupClipboardUser();
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

      await user.click(button);

      await waitFor(() => expect(button).toHaveTextContent("Done"));
    });

    it("does not announce a stale success after the latest copy fails", async () => {
      const user = setupClipboardUser();
      const attemptA = createDeferred();
      const attemptB = createDeferred();
      writeText.mockReturnValueOnce(attemptA.promise).mockReturnValueOnce(attemptB.promise);
      const onCopy = vi.fn();
      const onCopyError = vi.fn();

      const { container } = render(
        <CodeBlock>
          <CodeBlock.Header>
            <CodeBlock.CopyButton source="x" onCopy={onCopy} onCopyError={onCopyError} />
          </CodeBlock.Header>
          <CodeBlock.Content>{"x"}</CodeBlock.Content>
        </CodeBlock>,
      );

      const button = screen.getByRole("button", { name: "Copy code to clipboard" });
      const live = container.querySelector('[aria-live="polite"]');

      await user.click(button);
      await user.click(button);

      await act(async () => {
        attemptB.reject(new Error("denied"));
        await attemptB.promise.catch(() => {});
      });
      await waitFor(() => expect(onCopyError).toHaveBeenCalledTimes(1));
      expect(button).toHaveAttribute("data-state", "idle");
      expect(live?.textContent).toBe("");

      await act(async () => {
        attemptA.resolve();
        await attemptA.promise;
      });

      expect(onCopy).not.toHaveBeenCalled();
      expect(button).toHaveAttribute("data-state", "idle");
      expect(live?.textContent).toBe("");
    });
  });

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
