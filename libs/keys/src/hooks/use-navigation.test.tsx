import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { testNavigationBehavior } from "../testing/navigation-behavior.js";
import {
  type UseNavigationOptions,
  type UseNavigationReturn,
  useNavigation,
} from "./use-navigation.js";

function itemId(value: string) {
  return value === "" ? "item-empty" : `item-${value}`;
}

function TestList({
  items = ["a", "b", "c"],
  ...options
}: Partial<UseNavigationOptions> & { items?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const result = useNavigation({
    containerRef: ref,
    role: "option",
    ...options,
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
      {items.map((item) => (
        <div
          key={item}
          id={itemId(item)}
          role="option"
          data-value={item}
          aria-selected={result.isHighlighted(item)}
        >
          {item || "Empty"}
        </div>
      ))}
      <button type="button" onClick={() => result.highlight("b")}>
        Highlight B
      </button>
      <button type="button" onClick={() => result.highlight(null)}>
        Clear Highlight
      </button>
    </div>
  );
}

function activeOption() {
  const listbox = screen.getByRole("listbox", { name: "Items" });
  const activeId = listbox.getAttribute("aria-activedescendant");
  return activeId ? document.getElementById(activeId) : null;
}

function expectActiveOptionText(text: string) {
  expect(activeOption()?.textContent).toBe(text);
}

async function focusListbox() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("listbox", { name: "Items" }));
  return user;
}

describe("useNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  describe("vertical arrow / Home / End navigation matrix", () => {
    testNavigationBehavior({
      setup: () => {
        const result = render(<TestList defaultHighlighted="b" />);
        screen.getByRole("listbox", { name: "Items" }).focus();
        return result;
      },
      items: ["a", "b", "c"],
      initialActive: 1,
      cases: [
        { key: "{ArrowDown}", expectedActiveIndex: 2, label: "ArrowDown" },
        { key: "{ArrowUp}", expectedActiveIndex: 0, label: "ArrowUp" },
        { key: "{Home}", expectedActiveIndex: 0, label: "Home" },
        { key: "{End}", expectedActiveIndex: 2, label: "End" },
      ],
    });
  });

  it("wraps navigation when reaching list boundaries", async () => {
    render(<TestList defaultHighlighted="a" />);
    const user = await focusListbox();

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}");
    expectActiveOptionText("c");
  });

  it("reports non-wrapping boundary callbacks with event and key arguments", async () => {
    const onNavigationBoundaryReached = vi.fn();
    render(
      <TestList
        defaultHighlighted="c"
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
      />,
    );
    const user = await focusListbox();

    await user.keyboard("{ArrowDown}");
    expect(onNavigationBoundaryReached).toHaveBeenCalledWith(
      "next",
      expect.any(KeyboardEvent),
      "ArrowDown",
    );
    expectActiveOptionText("c");

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(onNavigationBoundaryReached).toHaveBeenCalledWith(
      "previous",
      expect.any(KeyboardEvent),
      "ArrowUp",
    );
    expectActiveOptionText("a");
  });

  it("invokes the latest inline boundary callback after rerenders without losing navigation", async () => {
    const spy = vi.fn();

    function RerenderingHost() {
      const [tick, setTick] = useState(0);
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        defaultHighlighted: "c",
        wrap: false,
        // fresh inline closure on every render; it must not become stale and
        // must not break navigation through repeated re-registration.
        onNavigationBoundaryReached: (direction) => spy(direction, tick),
      });

      return (
        <div>
          <button type="button" onClick={() => setTick((value) => value + 1)}>
            Bump
          </button>
          <div
            ref={ref}
            role="listbox"
            aria-label="Items"
            aria-activedescendant={
              result.highlighted === null ? undefined : itemId(result.highlighted)
            }
            tabIndex={0}
            onKeyDown={result.onKeyDown}
          >
            <div id="item-a" role="option" data-value="a">
              a
            </div>
            <div id="item-b" role="option" data-value="b">
              b
            </div>
            <div id="item-c" role="option" data-value="c">
              c
            </div>
          </div>
        </div>
      );
    }

    render(<RerenderingHost />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Bump" }));
    await user.click(screen.getByRole("button", { name: "Bump" }));
    await user.click(screen.getByRole("listbox", { name: "Items" }));

    await user.keyboard("{ArrowDown}");
    // latest closure fires (tick === 2), proving no stale capture from re-registration
    expect(spy).toHaveBeenLastCalledWith("next", 2);

    // navigation still works after the churn
    await user.keyboard("{ArrowUp}");
    expectActiveOptionText("b");
  });

  it("supports Home, End, and starting navigation without an initial highlight", async () => {
    render(<TestList />);
    const user = await focusListbox();

    await user.keyboard("{ArrowDown}");
    expectActiveOptionText("a");

    await user.keyboard("{End}");
    expectActiveOptionText("c");

    await user.keyboard("{Home}");
    expectActiveOptionText("a");
  });

  it("navigates data-marked items without role attributes", async () => {
    function DataMarkedList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        defaultHighlighted: "a",
      });

      return (
        <div
          ref={ref}
          role="listbox"
          aria-label="Items"
          aria-activedescendant={
            result.highlighted === null ? undefined : itemId(result.highlighted)
          }
          tabIndex={0}
          onKeyDown={result.onKeyDown}
        >
          <div id="item-a" data-diffgazer-navigation-item="option" data-value="a">
            A
          </div>
          <div id="item-b" data-diffgazer-navigation-item="option" data-value="b">
            B
          </div>
          <div id="item-c" data-diffgazer-navigation-item="option" data-value="c">
            C
          </div>
        </div>
      );
    }

    render(<DataMarkedList />);
    const user = await focusListbox();

    await user.keyboard("{ArrowDown}{End}");

    expectActiveOptionText("C");
  });

  it("falls back to native buttons with data values and ignores nested data-value descendants", async () => {
    function ButtonList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        defaultHighlighted: "one",
        moveFocus: true,
      });

      return (
        <div ref={ref} role="group" aria-label="Actions" tabIndex={0} onKeyDown={result.onKeyDown}>
          <button type="button" data-value="one">
            One <span data-value="nested">nested</span>
          </button>
          <button type="button" data-value="two">
            Two
          </button>
        </div>
      );
    }

    render(<ButtonList />);
    screen.getByRole("button", { name: "One nested" }).focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Two" }));
  });

  function NativeRadioGroups({ scopeToContainer }: { scopeToContainer?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const result = useNavigation({
      containerRef: ref,
      role: "radio",
      defaultHighlighted: "outer-a",
      scopeToContainer,
    });

    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label="Outer choices"
        aria-activedescendant={result.highlighted === null ? undefined : itemId(result.highlighted)}
        tabIndex={0}
        onKeyDown={result.onKeyDown}
      >
        <label>
          <input id="item-outer-a" type="radio" data-value="outer-a" />
          Outer A
        </label>
        <div role="radiogroup" aria-label="Nested choices">
          <label>
            <input id="item-inner-a" type="radio" data-value="inner-a" />
            Inner A
          </label>
        </div>
        <label>
          <input id="item-outer-b" type="radio" data-value="outer-b" />
          Outer B
        </label>
      </div>
    );
  }

  it("scopes navigation to the owning container by default", async () => {
    render(<NativeRadioGroups />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radiogroup", { name: "Outer choices" }));
    await user.keyboard("{ArrowDown}");
    expect(
      screen
        .getByRole("radiogroup", { name: "Outer choices" })
        .getAttribute("aria-activedescendant"),
    ).toBe("item-outer-b");
  });

  it("navigates into nested containers when scopeToContainer is false", async () => {
    render(<NativeRadioGroups scopeToContainer={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radiogroup", { name: "Outer choices" }));
    await user.keyboard("{ArrowDown}");
    expect(
      screen
        .getByRole("radiogroup", { name: "Outer choices" })
        .getAttribute("aria-activedescendant"),
    ).toBe("item-inner-a");
  });

  it("keeps grouped options navigable while filtering nested listboxes", async () => {
    function GroupedListbox() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        defaultHighlighted: "copy",
        scopeToContainer: true,
      });

      return (
        <div
          ref={ref}
          role="listbox"
          aria-label="Commands"
          aria-activedescendant={
            result.highlighted === null ? undefined : itemId(result.highlighted)
          }
          tabIndex={0}
          onKeyDown={result.onKeyDown}
        >
          <div role="group" aria-label="Actions">
            <div id="item-copy" role="option" data-value="copy">
              Copy
            </div>
            <div id="item-paste" role="option" data-value="paste">
              Paste
            </div>
          </div>
          <div role="listbox" aria-label="Nested">
            <div id="item-nested" role="option" data-value="nested">
              Nested
            </div>
          </div>
          <div id="item-delete" role="option" data-value="delete">
            Delete
          </div>
        </div>
      );
    }

    render(<GroupedListbox />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("listbox", { name: "Commands" }));
    await user.keyboard("{ArrowDown}{ArrowDown}");

    expect(
      screen.getByRole("listbox", { name: "Commands" }).getAttribute("aria-activedescendant"),
    ).toBe("item-delete");
  });

  it("activates virtual highlighted item with Space and Enter on listbox", async () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    render(<TestList defaultHighlighted="b" onSelect={onSelect} onEnter={onEnter} />);
    const user = await focusListbox();

    await user.keyboard(" {Enter}");

    expect(onSelect).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
    expect(onEnter).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
  });

  it("activates focused item with Space in a real DOM focus action list", async () => {
    const onFocusedSelect = vi.fn();
    render(
      <div>
        <FocusedActionList onSelect={onFocusedSelect} />
      </div>,
    );
    screen.getByRole("button", { name: "B" }).focus();
    await userEvent.keyboard(" ");
    expect(onFocusedSelect).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
  });

  it("supports empty string item values", async () => {
    const onSelect = vi.fn();
    render(<TestList items={["", "b"]} defaultHighlighted="" onSelect={onSelect} />);
    const user = await focusListbox();

    expect(screen.getByRole("option", { name: "Empty" }).getAttribute("aria-selected")).toBe(
      "true",
    );

    await user.keyboard("{Enter}{ArrowDown}{ArrowUp}");

    expect(onSelect).toHaveBeenCalledWith("", expect.any(KeyboardEvent));
    expect(screen.getByRole("option", { name: "Empty" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("ignores navigation and activation when enabled is false", async () => {
    const onSelect = vi.fn();
    render(<TestList defaultHighlighted="a" enabled={false} onSelect={onSelect} />);
    const user = await focusListbox();

    await user.keyboard("{ArrowDown} ");
    expectActiveOptionText("a");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("delegates highlight changes to onHighlightChange in controlled mode", async () => {
    const onHighlightChange = vi.fn();
    render(<TestList highlighted="b" onHighlightChange={onHighlightChange} />);
    const user = await focusListbox();
    await user.keyboard("{ArrowDown}");
    expect(onHighlightChange).toHaveBeenCalledWith("c");
  });

  it("navigates with custom upKeys and downKeys", async () => {
    render(
      <TestList defaultHighlighted="a" upKeys={["ArrowUp", "k"]} downKeys={["ArrowDown", "j"]} />,
    );
    const user = await focusListbox();
    await user.keyboard("j");
    expectActiveOptionText("b");
    await user.keyboard("k");
    expectActiveOptionText("a");
  });

  it("navigates with ArrowRight and ArrowLeft in horizontal orientation", async () => {
    render(<TestList defaultHighlighted="a" orientation="horizontal" />);
    const user = await focusListbox();

    await user.keyboard("{ArrowRight}{ArrowLeft}{ArrowDown}");
    expectActiveOptionText("a");
  });

  it("skips disabled items by default", async () => {
    function DisabledItemList({ skipDisabled }: { skipDisabled?: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        defaultHighlighted: "a",
        skipDisabled,
      });

      return (
        <div
          ref={ref}
          role="listbox"
          aria-label="Items"
          aria-activedescendant={
            result.highlighted === null ? undefined : itemId(result.highlighted)
          }
          tabIndex={0}
          onKeyDown={result.onKeyDown}
        >
          <div id="item-a" role="option" data-value="a">
            A
          </div>
          <div id="item-b" role="option" data-value="b" aria-disabled="true">
            B
          </div>
          <div id="item-c" role="option" data-value="c">
            C
          </div>
        </div>
      );
    }

    render(<DisabledItemList />);
    const user = await focusListbox();
    await user.keyboard("{ArrowDown}");
    expectActiveOptionText("C");
  });

  it("navigates to disabled items when skipDisabled is false", async () => {
    function DisabledItemList({ skipDisabled }: { skipDisabled?: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        defaultHighlighted: "a",
        skipDisabled,
      });

      return (
        <div
          ref={ref}
          role="listbox"
          aria-label="Items"
          aria-activedescendant={
            result.highlighted === null ? undefined : itemId(result.highlighted)
          }
          tabIndex={0}
          onKeyDown={result.onKeyDown}
        >
          <div id="item-a" role="option" data-value="a">
            A
          </div>
          <div id="item-b" role="option" data-value="b" aria-disabled="true">
            B
          </div>
          <div id="item-c" role="option" data-value="c">
            C
          </div>
        </div>
      );
    }

    render(<DisabledItemList skipDisabled={false} />);
    const user = await focusListbox();
    await user.keyboard("{ArrowDown}");
    expectActiveOptionText("B");
  });

  it("moves DOM focus when moveFocus is enabled without activating by default", async () => {
    function MoveFocusList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        defaultHighlighted: "a",
        moveFocus: true,
      });

      return (
        <div ref={ref} role="group" aria-label="Actions" tabIndex={0} onKeyDown={result.onKeyDown}>
          <button type="button" data-value="a">
            A
          </button>
          <button type="button" data-value="b">
            B
          </button>
          <button type="button" data-value="c">
            C
          </button>
        </div>
      );
    }

    render(<MoveFocusList />);
    const first = screen.getByRole("button", { name: "A" });
    first.focus();

    await userEvent.keyboard("{ArrowDown}{End}{Home} {Enter}");

    expect(document.activeElement).toBe(first);
  });

  it("activates the focused value when moveFocus has explicit activation handlers", async () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();

    function MoveFocusActivationList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        defaultHighlighted: "a",
        moveFocus: true,
        onSelect,
        onEnter,
      });

      return (
        <div ref={ref} role="group" aria-label="Actions" tabIndex={0} onKeyDown={result.onKeyDown}>
          <button type="button" data-value="a">
            A
          </button>
          <button type="button" data-value="b">
            B
          </button>
        </div>
      );
    }

    render(<MoveFocusActivationList />);
    screen.getByRole("button", { name: "A" }).focus();

    await userEvent.keyboard("{ArrowDown} {Enter}");

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "B" }));
    expect(onEnter).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
    expect(onSelect).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
  });

  it("clears highlight when highlight(null) is called and notifies onHighlightChange with null", async () => {
    const onHighlightChange = vi.fn();
    render(<TestList defaultHighlighted="b" onHighlightChange={onHighlightChange} />);

    expect(screen.getByRole("option", { name: "b" }).getAttribute("aria-selected")).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: "Clear Highlight" }));

    expect(screen.getByRole("option", { name: "b" }).getAttribute("aria-selected")).toBe("false");
    expect(onHighlightChange).toHaveBeenCalledWith(null);
  });

  it("supports controlled highlighted={null}", async () => {
    const onHighlightChange = vi.fn();
    render(<TestList highlighted={null} onHighlightChange={onHighlightChange} />);

    const listbox = screen.getByRole("listbox", { name: "Items" });
    expect(listbox.getAttribute("aria-activedescendant")).toBeNull();

    const user = await focusListbox();
    await user.keyboard("{ArrowDown}");

    expect(onHighlightChange).toHaveBeenCalledWith("a");
  });

  it("clears aria-activedescendant when controlled highlighted changes from a value to null", () => {
    const { rerender } = render(<TestList highlighted="b" />);

    const listbox = screen.getByRole("listbox", { name: "Items" });
    expect(listbox.getAttribute("aria-activedescendant")).toBe("item-b");

    rerender(<TestList highlighted={null} />);
    expect(listbox.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("exposes highlight and isHighlighted to consumers", async () => {
    render(<TestList defaultHighlighted="a" />);

    expect(screen.getByRole("option", { name: "a" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("option", { name: "b" }).getAttribute("aria-selected")).toBe("false");

    await userEvent.click(screen.getByRole("button", { name: "Highlight B" }));

    expect(screen.getByRole("option", { name: "a" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("option", { name: "b" }).getAttribute("aria-selected")).toBe("true");
  });

  describe("editable target guard", () => {
    function ListWithSearch({ onSelect }: { onSelect?: (value: string) => void } = {}) {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        defaultHighlighted: "a",
        onSelect,
      });

      return (
        <div onKeyDown={result.onKeyDown}>
          <input type="text" aria-label="Search" defaultValue="hello" />
          <textarea aria-label="Notes" defaultValue="line1" />
          <div
            ref={ref}
            role="listbox"
            aria-label="Items"
            aria-activedescendant={
              result.highlighted === null ? undefined : itemId(result.highlighted)
            }
            tabIndex={0}
          >
            <div id="item-a" role="option" data-value="a">
              A
            </div>
            <div id="item-b" role="option" data-value="b">
              B
            </div>
          </div>
        </div>
      );
    }

    it("does not consume Arrow/Home/End keys originating in an input above the listbox", async () => {
      render(<ListWithSearch />);

      const input = screen.getByRole("textbox", { name: "Search" }) as HTMLInputElement;
      input.focus();
      input.setSelectionRange(0, 0);

      const user = userEvent.setup();
      // Move caret to the right (end). If we swallow ArrowRight, caret would not move.
      await user.keyboard("{ArrowRight}{End}");

      expect(input.selectionStart).toBe(input.value.length);
      // Listbox should not have advanced highlight
      expect(
        screen.getByRole("listbox", { name: "Items" }).getAttribute("aria-activedescendant"),
      ).toBe("item-a");
    });

    it("does not consume Enter/Space keys originating in a textarea above the listbox", async () => {
      const onSelect = vi.fn();
      render(<ListWithSearch onSelect={onSelect} />);

      const textarea = screen.getByRole("textbox", { name: "Notes" }) as HTMLTextAreaElement;
      textarea.focus();

      const user = userEvent.setup();
      const before = textarea.value;
      await user.keyboard(" {Enter}");

      // Textarea should accept the keys (value changed)
      expect(textarea.value).not.toBe(before);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("does not consume keys originating in contenteditable above the listbox", async () => {
      function ListWithCE() {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "option",
          defaultHighlighted: "a",
        });
        return (
          <div onKeyDown={result.onKeyDown}>
            <div contentEditable role="textbox" aria-label="CE" suppressContentEditableWarning>
              hello
            </div>
            <div
              ref={ref}
              role="listbox"
              aria-label="Items"
              aria-activedescendant={
                result.highlighted === null ? undefined : itemId(result.highlighted)
              }
              tabIndex={0}
            >
              <div id="item-a" role="option" data-value="a">
                A
              </div>
              <div id="item-b" role="option" data-value="b">
                B
              </div>
            </div>
          </div>
        );
      }
      render(<ListWithCE />);

      const ce = screen.getByRole("textbox", { name: "CE" });
      ce.focus();

      const user = userEvent.setup();
      await user.keyboard("{ArrowDown}");

      expect(
        screen.getByRole("listbox", { name: "Items" }).getAttribute("aria-activedescendant"),
      ).toBe("item-a");
    });

    it("still navigates when an editable element is itself a navigation item", async () => {
      function CheckboxList() {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "checkbox",
          defaultHighlighted: "a",
          moveFocus: true,
        });
        return (
          <div ref={ref} role="group" aria-label="Choices" onKeyDown={result.onKeyDown}>
            <input type="checkbox" data-value="a" aria-label="A" />
            <input type="checkbox" data-value="b" aria-label="B" />
          </div>
        );
      }
      render(<CheckboxList />);
      const a = screen.getByRole("checkbox", { name: "A" });
      a.focus();
      const user = userEvent.setup();
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "B" }));
    });
  });

  describe("Enter/Space without consumer handlers", () => {
    function ListNoHandlers() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        defaultHighlighted: "a",
      });
      return (
        <div
          ref={ref}
          role="listbox"
          aria-label="Items"
          aria-activedescendant={
            result.highlighted === null ? undefined : itemId(result.highlighted)
          }
          tabIndex={0}
          onKeyDown={result.onKeyDown}
        >
          <div id="item-a" role="option" data-value="a">
            A
          </div>
          <div id="item-b" role="option" data-value="b">
            B
          </div>
        </div>
      );
    }

    it("does not preventDefault on Enter when no onEnter/onSelect is provided", async () => {
      render(<ListNoHandlers />);
      const listbox = screen.getByRole("listbox", { name: "Items" });
      listbox.focus();

      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      listbox.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });

    it("does not preventDefault on Space when no onSelect is provided", async () => {
      render(<ListNoHandlers />);
      const listbox = screen.getByRole("listbox", { name: "Items" });
      listbox.focus();

      const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
      listbox.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });

    it("does preventDefault on Enter when onEnter is provided", async () => {
      const onEnter = vi.fn();
      function ListWithEnter() {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "option",
          defaultHighlighted: "a",
          onEnter,
        });
        return (
          <div
            ref={ref}
            role="listbox"
            aria-label="Items"
            aria-activedescendant={
              result.highlighted === null ? undefined : itemId(result.highlighted)
            }
            tabIndex={0}
            onKeyDown={result.onKeyDown}
          >
            <div id="item-a" role="option" data-value="a">
              A
            </div>
          </div>
        );
      }
      render(<ListWithEnter />);
      const listbox = screen.getByRole("listbox", { name: "Items" });
      listbox.focus();

      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      listbox.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(onEnter).toHaveBeenCalledWith("a", expect.any(KeyboardEvent));
    });
  });

  describe("role-only items without data-value", () => {
    it("ignores role-only items without data-value during navigation", async () => {
      function RoleOnlyList() {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "option",
          defaultHighlighted: null,
        });
        return (
          <div
            ref={ref}
            role="listbox"
            aria-label="Items"
            aria-activedescendant={
              result.highlighted === null ? undefined : itemId(result.highlighted)
            }
            tabIndex={0}
            onKeyDown={result.onKeyDown}
          >
            <div role="option">A</div>
            <div role="option">B</div>
            <div role="option">C</div>
          </div>
        );
      }

      render(<RoleOnlyList />);
      const listbox = screen.getByRole("listbox", { name: "Items" });
      listbox.focus();

      const user = userEvent.setup();
      await user.keyboard("{ArrowDown}{ArrowDown}");

      expect(listbox.getAttribute("aria-activedescendant")).toBeNull();
    });

    it("does not fire boundary callback for empty navigable lists", async () => {
      const onBoundary = vi.fn();
      function HostList() {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "option",
          defaultHighlighted: null,
          wrap: false,
          onNavigationBoundaryReached: onBoundary,
        });
        return (
          <div
            ref={ref}
            role="listbox"
            aria-label="Items"
            aria-activedescendant={
              result.highlighted === null ? undefined : itemId(result.highlighted)
            }
            tabIndex={0}
            onKeyDown={result.onKeyDown}
          >
            <div role="option">A</div>
            <div role="option">B</div>
          </div>
        );
      }

      render(<HostList />);
      const host = screen.getByRole("listbox", { name: "Items" });
      host.focus();
      const user = userEvent.setup();
      await user.keyboard("{ArrowDown}");

      expect(host.getAttribute("aria-activedescendant")).toBeNull();
      expect(onBoundary).not.toHaveBeenCalled();
    });
  });

  describe("disabled by role", () => {
    it("keeps disabled menuitems discoverable per APG", async () => {
      function MenuList() {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "menuitem",
          defaultHighlighted: "a",
          moveFocus: true,
          skipDisabled: false,
        });
        return (
          <div ref={ref} role="menu" aria-label="Menu" onKeyDown={result.onKeyDown}>
            <div id="item-a" role="menuitem" data-value="a" tabIndex={0}>
              A
            </div>
            <div id="item-b" role="menuitem" data-value="b" aria-disabled="true" tabIndex={-1}>
              B
            </div>
            <div id="item-c" role="menuitem" data-value="c" tabIndex={-1}>
              C
            </div>
          </div>
        );
      }
      render(<MenuList />);
      const a = screen.getByRole("menuitem", { name: "A" });
      a.focus();

      const user = userEvent.setup();
      await user.keyboard("{ArrowDown}");

      expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "B" }));
    });
  });

  describe("types", () => {
    it("narrows highlighted/onSelect to the supplied union", () => {
      type Narrow = UseNavigationOptions<"a" | "b">;
      type ReturnNarrow = UseNavigationReturn<"a" | "b">;

      expectTypeOf<Narrow["highlighted"]>().toEqualTypeOf<"a" | "b" | null | undefined>();
      expectTypeOf<NonNullable<Narrow["onSelect"]>>().parameter(0).toEqualTypeOf<"a" | "b">();
      expectTypeOf<NonNullable<Narrow["onHighlightChange"]>>()
        .parameter(0)
        .toEqualTypeOf<"a" | "b" | null>();
      expectTypeOf<ReturnNarrow["highlighted"]>().toEqualTypeOf<"a" | "b" | null>();
    });

    it("keeps the loose default contract when no generic is supplied", () => {
      expectTypeOf<UseNavigationOptions["highlighted"]>().toEqualTypeOf<
        string | null | undefined
      >();
      expectTypeOf<UseNavigationReturn["highlighted"]>().toEqualTypeOf<string | null>();
    });
  });
});

function FocusedActionList({
  onSelect,
}: {
  onSelect: (value: string, event: KeyboardEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const result = useNavigation({
    containerRef: ref,
    role: "button",
    defaultHighlighted: "a",
    onSelect,
  });

  return (
    <div ref={ref} role="group" aria-label="Actions" tabIndex={0} onKeyDown={result.onKeyDown}>
      <button type="button" data-value="a">
        A
      </button>
      <button type="button" data-value="b">
        B
      </button>
    </div>
  );
}
