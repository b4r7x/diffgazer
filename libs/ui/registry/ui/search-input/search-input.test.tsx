import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import SearchInputCustom from "../../examples/search-input/search-input-custom";
import { SearchInput, type SearchInputProps } from "./index";

function renderSearchInput(props: Partial<SearchInputProps> = {}) {
  return render(<SearchInput aria-label="Search" {...props} />);
}

describe("SearchInput", () => {
  it("updates value when typing (uncontrolled)", async () => {
    const user = userEvent.setup();
    renderSearchInput();
    const input = screen.getByRole("searchbox");
    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  it("fires onChange in controlled mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSearchInput({ value: "", onChange });
    const input = screen.getByRole("searchbox");
    await user.type(input, "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("calls onEscape when Escape is pressed on an empty input", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    renderSearchInput({ onEscape });
    const input = screen.getByRole("searchbox");
    input.focus();
    await user.keyboard("{Escape}");
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it("clears a non-empty value on Escape and prevents default", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    renderSearchInput({ onEscape });
    const input = screen.getByRole("searchbox");
    await user.type(input, "hello");
    input.focus();

    const escapeEvent = createEvent.keyDown(input, { key: "Escape" });
    // fireEvent retained: custom KeyboardEvent instance exposes defaultPrevented after dispatch.
    fireEvent(input, escapeEvent);

    expect(escapeEvent.defaultPrevented).toBe(true);
    expect(input).toHaveValue("");
    // Clearing takes precedence over onEscape.
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("leaves Escape untouched on an empty input with no onEscape so a dialog can cancel", () => {
    renderSearchInput();
    const input = screen.getByRole("searchbox");
    input.focus();

    const escapeEvent = createEvent.keyDown(input, { key: "Escape" });
    // fireEvent retained: custom KeyboardEvent instance exposes defaultPrevented after dispatch.
    fireEvent(input, escapeEvent);

    expect(escapeEvent.defaultPrevented).toBe(false);
  });

  it("calls onEnter when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    renderSearchInput({ onEnter });
    const input = screen.getByRole("searchbox");
    input.focus();
    await user.keyboard("{Enter}");
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("forwards custom onKeyDown alongside built-in handler", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const onEnter = vi.fn();
    renderSearchInput({ onEnter, onKeyDown });
    const input = screen.getByRole("searchbox");
    input.focus();
    await user.keyboard("{Enter}");
    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("honors preventDefault in custom key handlers", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    renderSearchInput({ onEnter, onKeyDown: (event) => event.preventDefault() });
    const input = screen.getByRole("searchbox");
    input.focus();
    await user.keyboard("{Enter}");
    expect(onEnter).not.toHaveBeenCalled();
  });

  it.each([
    { name: "composition state", event: { isComposing: true } },
    { name: "legacy IME key code", event: { keyCode: 229 } },
  ])("leaves Enter and Escape untouched during $name", ({ event }) => {
    const onEnter = vi.fn();
    const onEscape = vi.fn();
    renderSearchInput({ defaultValue: "composing", onEnter, onEscape });
    const input = screen.getByRole("searchbox");

    for (const key of ["Enter", "Escape"]) {
      const keyDown = createEvent.keyDown(input, { key, ...event });
      // fireEvent retained: the same KeyboardEvent instance proves the IME path does not cancel
      // the browser's composition-confirmation or composition-cancellation behavior.
      fireEvent(input, keyDown);
      expect(keyDown.defaultPrevented).toBe(false);
    }

    expect(input).toHaveValue("composing");
    expect(onEnter).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("resets uncontrolled value with native form reset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form>
        <SearchInput name="query" aria-label="Search" defaultValue="initial" onChange={onChange} />
        <button type="reset">Reset search</button>
      </form>,
    );

    const input = screen.getByRole("searchbox");
    await user.clear(input);
    await user.type(input, "changed");
    expect(input).toHaveValue("changed");
    const callbackCount = onChange.mock.calls.length;
    expect(callbackCount).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Reset search" }));
    await waitFor(() => expect(input).toHaveValue("initial"));
    expect(onChange).toHaveBeenCalledTimes(callbackCount);
  });

  it("keeps an input mutation newer than a same-task form reset", async () => {
    render(
      <form aria-label="Search form">
        <SearchInput aria-label="Search" defaultValue="initial" />
      </form>,
    );
    const input = screen.getByRole("searchbox");
    const form = screen.getByRole("form", { name: "Search form" }) as HTMLFormElement;

    form.reset();
    // fireEvent retained: mutation must remain in the reset task before its microtask can flush.
    fireEvent.change(input, { target: { value: "later" } });
    await Promise.resolve();

    expect(input).toHaveValue("later");
  });

  it("applies a SearchInput reset before a later mutation", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Search form">
        <SearchInput name="query" aria-label="Search" defaultValue="initial" />
      </form>,
    );
    const input = screen.getByRole("searchbox");
    const form = screen.getByRole("form", { name: "Search form" }) as HTMLFormElement;

    await user.clear(input);
    await user.type(input, "changed");
    expect(new FormData(form).get("query")).toBe("changed");

    form.reset();
    await waitFor(() => expect(input).toHaveValue("initial"));
    expect(new FormData(form).get("query")).toBe("initial");

    await user.clear(input);
    await user.type(input, "later");
    expect(input).toHaveValue("later");
    expect(new FormData(form).get("query")).toBe("later");
  });

  it("has no a11y violations", async () => {
    const { container } = renderSearchInput();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations when disabled", async () => {
    const { container } = renderSearchInput({ disabled: true });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("forwards aria-invalid through to the search input", () => {
    renderSearchInput({ "aria-invalid": true });
    expect(screen.getByRole("searchbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders a custom prefix", () => {
    renderSearchInput({ prefix: <span>find:</span> });
    expect(screen.getByText("find:")).toBeInTheDocument();
  });

  it("keeps decorative default and public-example prefixes out of the accessibility tree", () => {
    const { rerender } = renderSearchInput();
    expect(screen.getByText("/")).toHaveAttribute("aria-hidden", "true");

    rerender(<SearchInputCustom />);

    expect(screen.getByText("$")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(">")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("searchbox", { name: "Type and press Enter..." })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Uncontrolled search" })).toBeInTheDocument();
  });

  it("preserves caller-provided aria-invalid values", () => {
    const { rerender } = renderSearchInput({ "aria-invalid": "false" });

    expect(screen.getByRole("searchbox")).toHaveAttribute("aria-invalid", "false");

    rerender(<SearchInput aria-label="Search" aria-invalid="grammar" />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("aria-invalid", "grammar");
  });
});
