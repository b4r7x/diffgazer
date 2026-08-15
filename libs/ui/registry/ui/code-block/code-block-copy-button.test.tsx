import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeBlock } from "./index";

describe("copy button", () => {
  let writeText: ReturnType<typeof vi.fn>;

  // Define the one missing Navigator member instead of replacing the global:
  // jsdom exposes Navigator attributes as prototype accessors, so spreading
  // `navigator` into a stub object silently drops every other member.
  function stubClipboard() {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  }

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis.navigator, "clipboard");
  });

  function setupClipboardUser(options?: Parameters<typeof userEvent.setup>[0]) {
    const user = userEvent.setup(options);
    // userEvent.setup installs its own clipboard stub; put the spy back.
    stubClipboard();
    return user;
  }

  it("keeps an explicit aria-label when provided", () => {
    render(
      <CodeBlock>
        <CodeBlock.Header>
          <CodeBlock.CopyButton source="hello world" aria-label="Copy snippet" />
        </CodeBlock.Header>
        <CodeBlock.Content>{"hello world"}</CodeBlock.Content>
      </CodeBlock>,
    );

    expect(screen.getByRole("button", { name: "Copy snippet" })).toHaveAttribute(
      "aria-label",
      "Copy snippet",
    );
  });

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

  it("calls onCopyError with failed data-state and an announced failure when the clipboard write rejects", async () => {
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
    expect(button).toHaveAttribute("data-state", "failed");
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("Copy failed");
  });

  it("announces copy failure without an onCopyError callback", async () => {
    const user = setupClipboardUser();
    writeText.mockRejectedValueOnce(new Error("denied"));
    const { container } = render(
      <CodeBlock>
        <CodeBlock.Header>
          <CodeBlock.CopyButton source="hi" />
        </CodeBlock.Header>
        <CodeBlock.Content>{"hi"}</CodeBlock.Content>
      </CodeBlock>,
    );

    const button = screen.getByRole("button", { name: "Copy code to clipboard" });
    await user.click(button);

    await waitFor(() => expect(button).toHaveAttribute("data-state", "failed"));
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("Copy failed");
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

  it("invokes children as a render prop with the copy state and names the button from its text", async () => {
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

    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toHaveTextContent("Go");

    await user.click(button);

    await waitFor(() => expect(button).toHaveTextContent("Done"));
  });
});
