import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNavigation } from "../use-navigation";

function itemId(value: string) {
  return value === "" ? "item-empty" : `item-${value}`;
}

function activeOption(label = "Items") {
  const listbox = screen.getByRole("listbox", { name: label });
  const activeId = listbox.getAttribute("aria-activedescendant");
  return activeId ? document.getElementById(activeId) : null;
}

async function focusListbox(label = "Items") {
  const user = userEvent.setup();
  await user.click(screen.getByRole("listbox", { name: label }));
  return user;
}

describe("useNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("navigates data-marked items without role attributes", async () => {
    function DataMarkedList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        initialValue: "a",
      });

      return (
        <div
          ref={ref}
          role="listbox"
          aria-label="Items"
          aria-activedescendant={result.highlighted === null ? undefined : itemId(result.highlighted)}
          tabIndex={0}
          onKeyDown={result.onKeyDown}
        >
          <div id="item-a" data-diffgazer-navigation-item="option" data-value="a">A</div>
          <div id="item-b" data-diffgazer-navigation-item="option" data-value="b">B</div>
          <div id="item-c" data-diffgazer-navigation-item="option" data-value="c">C</div>
        </div>
      );
    }

    render(<DataMarkedList />);
    const user = await focusListbox();

    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("B");
  });

  it("supports native buttons with data values", async () => {
    function NativeButtonList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        initialValue: "a",
        moveFocus: true,
      });

      return (
        <div ref={ref} role="group" aria-label="Actions" tabIndex={0} onKeyDown={result.onKeyDown}>
          <button data-value="a" type="button">A</button>
          <button data-value="b" type="button">B</button>
          <button data-value="c" type="button">C</button>
        </div>
      );
    }

    render(<NativeButtonList />);
    screen.getByRole("button", { name: "A" }).focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: "B" })).toHaveFocus();
  });

  it("starts forward navigation on the first enabled item when nothing is highlighted", async () => {
    function DataMarkedList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
      });

      return (
        <div
          ref={ref}
          role="listbox"
          aria-label="Items"
          aria-activedescendant={result.highlighted === null ? undefined : itemId(result.highlighted)}
          tabIndex={0}
          onKeyDown={result.onKeyDown}
        >
          <div id="item-a" data-diffgazer-navigation-item="option" data-value="a">A</div>
          <div id="item-b" data-diffgazer-navigation-item="option" data-value="b">B</div>
        </div>
      );
    }

    render(<DataMarkedList />);
    const user = await focusListbox();

    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("A");
  });

  it("continues navigation from the currently focused DOM item", async () => {
    function FocusedList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        moveFocus: true,
      });

      return (
        <div ref={ref} role="group" aria-label="Actions" tabIndex={0} onKeyDown={result.onKeyDown}>
          <button data-value="a" type="button">A</button>
          <button data-value="b" type="button">B</button>
          <button data-value="c" type="button">C</button>
        </div>
      );
    }

    render(<FocusedList />);
    screen.getByRole("button", { name: "B" }).focus();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "C" })).toHaveFocus();
  });

  it("supports empty string item values for highlight and selection", async () => {
    const onSelect = vi.fn();

    function EmptyValueList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        initialValue: "",
        onSelect,
      });

      return (
        <div
          ref={ref}
          role="listbox"
          aria-label="Items"
          aria-activedescendant={result.highlighted === null ? undefined : itemId(result.highlighted)}
          tabIndex={0}
          onKeyDown={result.onKeyDown}
        >
          <div id="item-empty" role="option" data-value="" aria-selected={result.isHighlighted("")}>
            Empty
          </div>
          <div id="item-b" role="option" data-value="b" aria-selected={result.isHighlighted("b")}>
            B
          </div>
        </div>
      );
    }

    render(<EmptyValueList />);
    const user = await focusListbox();

    expect(screen.getByRole("option", { name: "Empty" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}{ArrowDown}{ArrowUp}");

    expect(onSelect).toHaveBeenCalledWith("", expect.any(KeyboardEvent));
    expect(screen.getByRole("option", { name: "Empty" })).toHaveAttribute("aria-selected", "true");
  });
});
