import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeBlock } from "./index";

describe("copy button", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("writes the source to the clipboard on click and calls onCopy", async () => {
    const user = setupClipboardUser();
    const onCopy = vi.fn();
    render(
      <CodeBlock>
        <CodeBlock.Header>
          <CodeBlock.CopyButton source="hello world" onCopy={onCopy} />
        </CodeBlock.Header>
        <CodeBlock.Content>{"hello world"}</CodeBlock.Content>
      </CodeBlock>,
    );

    await user.click(screen.getByRole("button", { name: "Copy code to clipboard" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("hello world"));
    expect(onCopy).toHaveBeenCalledWith("hello world");
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

  it("calls onCopyError with idle data-state and an empty live region when the clipboard write rejects", async () => {
    const user = setupClipboardUser();
    writeText.mockRejectedValueOnce(new Error("denied"));
    const onCopyError = vi.fn();
    const { container } = render(
      <CodeBlock>
        <CodeBlock.Header>
          <CodeBlock.CopyButton source="hi" onCopyError={onCopyError} />
        </CodeBlock.Header>
        <CodeBlock.Content>{"hi"}</CodeBlock.Content>
      </CodeBlock>,
    );

    const button = screen.getByRole("button", { name: "Copy code to clipboard" });
    await user.click(button);

    await waitFor(() => expect(onCopyError).toHaveBeenCalledTimes(1));
    expect(onCopyError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(button).toHaveAttribute("data-state", "idle");
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("");
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
});
