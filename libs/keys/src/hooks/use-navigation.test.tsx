import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNavigation, type UseNavigationOptions } from "./use-navigation";

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

  it("navigates options with arrow keys, wraps, and reports non-wrapping boundaries", async () => {
    render(<TestList defaultHighlighted="a" />);
    let user = await focusListbox();

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}");
    expectActiveOptionText("c");

    cleanup();
    const onNavigationBoundaryReached = vi.fn();
    render(
      <TestList
        defaultHighlighted="c"
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
      />,
    );
    user = await focusListbox();

    await user.keyboard("{ArrowDown}");
    expect(onNavigationBoundaryReached).toHaveBeenCalledWith("next");
    expectActiveOptionText("c");

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(onNavigationBoundaryReached).toHaveBeenCalledWith("previous");
    expectActiveOptionText("a");
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
          aria-activedescendant={result.highlighted === null ? undefined : itemId(result.highlighted)}
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

  it("scopes navigation to the owning container by default", async () => {
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

    render(<NativeRadioGroups />);
    let user = userEvent.setup();
    await user.click(screen.getByRole("radiogroup", { name: "Outer choices" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radiogroup", { name: "Outer choices" }).getAttribute("aria-activedescendant")).toBe(
      "item-outer-b",
    );

    cleanup();
    render(<NativeRadioGroups scopeToContainer={false} />);
    user = userEvent.setup();
    await user.click(screen.getByRole("radiogroup", { name: "Outer choices" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radiogroup", { name: "Outer choices" }).getAttribute("aria-activedescendant")).toBe(
      "item-inner-a",
    );
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
          aria-activedescendant={result.highlighted === null ? undefined : itemId(result.highlighted)}
          tabIndex={0}
          onKeyDown={result.onKeyDown}
        >
          <div role="group" aria-label="Actions">
            <div id="item-copy" role="option" data-value="copy">Copy</div>
            <div id="item-paste" role="option" data-value="paste">Paste</div>
          </div>
          <div role="listbox" aria-label="Nested">
            <div id="item-nested" role="option" data-value="nested">Nested</div>
          </div>
          <div id="item-delete" role="option" data-value="delete">Delete</div>
        </div>
      );
    }

    render(<GroupedListbox />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("listbox", { name: "Commands" }));
    await user.keyboard("{ArrowDown}{ArrowDown}");

    expect(screen.getByRole("listbox", { name: "Commands" }).getAttribute("aria-activedescendant")).toBe(
      "item-delete",
    );
  });

  it("activates highlighted and focused items with Space and Enter", async () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    render(<TestList defaultHighlighted="b" onSelect={onSelect} onEnter={onEnter} />);
    const user = await focusListbox();

    await user.keyboard(" {Enter}");

    expect(onSelect).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
    expect(onEnter).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));

    cleanup();
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

    expect(screen.getByRole("option", { name: "Empty" }).getAttribute("aria-selected")).toBe("true");

    await user.keyboard("{Enter}{ArrowDown}{ArrowUp}");

    expect(onSelect).toHaveBeenCalledWith("", expect.any(KeyboardEvent));
    expect(screen.getByRole("option", { name: "Empty" }).getAttribute("aria-selected")).toBe("true");
  });

  it("honors disabled, controlled, and custom key options", async () => {
    const onSelect = vi.fn();
    const onHighlightChange = vi.fn();
    render(<TestList defaultHighlighted="a" enabled={false} onSelect={onSelect} />);
    let user = await focusListbox();

    await user.keyboard("{ArrowDown} ");
    expectActiveOptionText("a");
    expect(onSelect).not.toHaveBeenCalled();

    cleanup();
    render(<TestList highlighted="b" onHighlightChange={onHighlightChange} />);
    user = await focusListbox();
    await user.keyboard("{ArrowDown}");
    expect(onHighlightChange).toHaveBeenCalledWith("c");

    cleanup();
    render(<TestList defaultHighlighted="a" upKeys={["ArrowUp", "k"]} downKeys={["ArrowDown", "j"]} />);
    user = await focusListbox();
    await user.keyboard("j");
    expectActiveOptionText("b");
    await user.keyboard("k");
    expectActiveOptionText("a");
  });

  it("supports horizontal navigation and skips disabled items by default", async () => {
    render(<TestList defaultHighlighted="a" orientation="horizontal" />);
    let user = await focusListbox();

    await user.keyboard("{ArrowRight}{ArrowLeft}{ArrowDown}");
    expectActiveOptionText("a");

    cleanup();
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
          aria-activedescendant={result.highlighted === null ? undefined : itemId(result.highlighted)}
          tabIndex={0}
          onKeyDown={result.onKeyDown}
        >
          <div id="item-a" role="option" data-value="a">A</div>
          <div id="item-b" role="option" data-value="b" aria-disabled="true">B</div>
          <div id="item-c" role="option" data-value="c">C</div>
        </div>
      );
    }

    render(<DisabledItemList />);
    user = await focusListbox();
    await user.keyboard("{ArrowDown}");
    expectActiveOptionText("C");

    cleanup();
    render(<DisabledItemList skipDisabled={false} />);
    user = await focusListbox();
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
          <button type="button" data-value="a">A</button>
          <button type="button" data-value="b">B</button>
          <button type="button" data-value="c">C</button>
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
          <button type="button" data-value="a">A</button>
          <button type="button" data-value="b">B</button>
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

  it("exposes highlight and isHighlighted to consumers", async () => {
    render(<TestList defaultHighlighted="a" />);

    expect(screen.getByRole("option", { name: "a" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("option", { name: "b" }).getAttribute("aria-selected")).toBe("false");

    await userEvent.click(screen.getByRole("button", { name: "Highlight B" }));

    expect(screen.getByRole("option", { name: "a" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("option", { name: "b" }).getAttribute("aria-selected")).toBe("true");
  });
});

function FocusedActionList({ onSelect }: { onSelect: (value: string, event: KeyboardEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const result = useNavigation({
    containerRef: ref,
    role: "button",
    defaultHighlighted: "a",
    onSelect,
  });

  return (
    <div ref={ref} role="group" aria-label="Actions" tabIndex={0} onKeyDown={result.onKeyDown}>
      <button type="button" data-value="a">A</button>
      <button type="button" data-value="b">B</button>
    </div>
  );
}
