import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { type ComponentType, useRef, useState } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { useNavigationDoc } from "../../docs/hook-docs/use-navigation.js";
import { useScopedNavigationDoc } from "../../docs/hook-docs/use-scoped-navigation.js";
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

function loadNavigationGuideExample(): ComponentType {
  const guide = readFileSync(join(process.cwd(), "docs/content/guides/navigation.mdx"), "utf8");
  const source = guide.match(/### DOM setup[\s\S]*?```tsx\n([\s\S]*?)\n```/)?.[1];
  if (!source) throw new Error("Navigation guide DOM setup example is missing");

  const exportableSource = source.replace("function FileList()", "export function FileList()");
  if (exportableSource === source) throw new Error("Navigation guide FileList example is missing");

  const { outputText } = transpileModule(exportableSource, {
    compilerOptions: {
      jsx: JsxEmit.ReactJSX,
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
    },
  });
  const exports: { FileList?: ComponentType } = {};
  const requireModule = (specifier: string) => {
    if (specifier === "@diffgazer/keys") return { useNavigation };
    if (specifier === "react") return React;
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    throw new Error(`Unexpected guide import: ${specifier}`);
  };
  runInNewContext(outputText, { console, exports, require: requireModule });
  if (!exports.FileList) throw new Error("Navigation guide did not export FileList");
  return exports.FileList;
}

describe("useNavigation", () => {
  it("keeps standalone and scoped activation callback metadata aligned", () => {
    const parameterDescriptions = (name: "onSelect" | "onEnter") =>
      [useNavigationDoc, useScopedNavigationDoc].map((doc) => {
        if (!doc.parameters) throw new Error("Navigation callback metadata is missing");
        return doc.parameters.find((parameter) => parameter.name === name)?.description;
      });
    const onSelectDescriptions = parameterDescriptions("onSelect");
    const onEnterDescriptions = parameterDescriptions("onEnter");

    expect(onSelectDescriptions).toEqual([onSelectDescriptions[0], onSelectDescriptions[0]]);
    expect(onSelectDescriptions[0]).toBe(
      "Called when Space selects the highlighted item, and as the Enter fallback when onEnter is not provided.",
    );
    expect(onEnterDescriptions).toEqual([onEnterDescriptions[0], onEnterDescriptions[0]]);
    expect(onEnterDescriptions[0]).toBe(
      "Called when Enter is pressed on the highlighted item. When provided, it overrides the onSelect Enter fallback.",
    );
  });

  it("executes the actual guide listbox fence through Tab and ArrowDown", async () => {
    const NavigationGuideListbox = loadNavigationGuideExample();
    const user = userEvent.setup();
    render(<NavigationGuideListbox />);

    await user.tab();
    const listbox = screen.getByRole("listbox", { name: "Project files" });
    expect(document.activeElement).toBe(listbox);
    expect(listbox.getAttribute("aria-activedescendant")).toBe("file-source");

    await user.keyboard("{ArrowDown}");

    expect(document.activeElement).toBe(listbox);
    expect(listbox.getAttribute("aria-activedescendant")).toBe("file-tests");
    expect(screen.getByRole("option", { name: "Tests" }).getAttribute("aria-selected")).toBe(
      "true",
    );
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

  it("ignores Ctrl/Meta/Alt-modified navigation keys without preventing browser defaults", () => {
    const onHighlightChange = vi.fn();
    render(<TestList defaultHighlighted="a" onHighlightChange={onHighlightChange} />);

    const listbox = screen.getByRole("listbox", { name: "Items" });
    listbox.focus();

    for (const eventInit of [
      { key: "ArrowDown", altKey: true },
      { key: "ArrowUp", metaKey: true },
      { key: "Home", ctrlKey: true },
    ] satisfies KeyboardEventInit[]) {
      const event = new KeyboardEvent("keydown", {
        ...eventInit,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        listbox.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(listbox.getAttribute("aria-activedescendant")).toBe("item-a");
    expect(onHighlightChange).not.toHaveBeenCalled();

    const arrowDown = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      listbox.dispatchEvent(arrowDown);
    });
    expect(arrowDown.defaultPrevented).toBe(true);
    expect(listbox.getAttribute("aria-activedescendant")).toBe("item-b");
  });

  it("leaves a descendant's prevented navigation action as the only action", async () => {
    const localAction = vi.fn();

    function NestedNavigation() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        defaultHighlighted: "first",
        moveFocus: true,
      });

      return (
        <div ref={ref} role="group" aria-label="Nested actions" onKeyDown={result.onKeyDown}>
          <button
            type="button"
            data-value="first"
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown") return;
              event.preventDefault();
              localAction();
            }}
          >
            First
          </button>
          <button type="button" data-value="second">
            Second
          </button>
        </div>
      );
    }

    render(<NestedNavigation />);
    const first = screen.getByRole("button", { name: "First" });
    first.focus();

    await userEvent.setup().keyboard("{ArrowDown}");

    expect(localAction).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(first);
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
    expect(spy).toHaveBeenLastCalledWith("next", 2);

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
    const user = userEvent.setup();
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
    await user.keyboard("{ArrowDown}");

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
    const user = userEvent.setup();
    const onFocusedSelect = vi.fn();
    render(
      <div>
        <FocusedActionList onSelect={onFocusedSelect} />
      </div>,
    );
    screen.getByRole("button", { name: "B" }).focus();
    await user.keyboard(" ");
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
    const user = userEvent.setup();
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

    await user.keyboard("{ArrowDown}{End}{Home} {Enter}");

    expect(document.activeElement).toBe(first);
  });

  it("activates the focused value when moveFocus has explicit activation handlers", async () => {
    const user = userEvent.setup();
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

    await user.keyboard("{ArrowDown} {Enter}");

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "B" }));
    expect(onEnter).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
    expect(onSelect).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
  });

  it("clears highlight when highlight(null) is called and notifies onHighlightChange with null", async () => {
    const user = userEvent.setup();
    const onHighlightChange = vi.fn();
    render(<TestList defaultHighlighted="b" onHighlightChange={onHighlightChange} />);

    expect(screen.getByRole("option", { name: "b" }).getAttribute("aria-selected")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Clear Highlight" }));

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
    const user = userEvent.setup();
    render(<TestList defaultHighlighted="a" />);

    expect(screen.getByRole("option", { name: "a" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("option", { name: "b" }).getAttribute("aria-selected")).toBe("false");

    await user.click(screen.getByRole("button", { name: "Highlight B" }));

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
      await user.keyboard("{ArrowRight}{End}");

      expect(input.selectionStart).toBe(input.value.length);
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

      expect(textarea.value).not.toBe(before);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("leaves the caret alone for Home/End in a search input when the list filters to zero items", () => {
      const onHighlightChange = vi.fn();

      function EmptyListWithSearch() {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "option",
          onHighlightChange,
          onSelect: vi.fn(),
        });

        return (
          <div onKeyDown={result.onKeyDown}>
            <input type="text" aria-label="Search" defaultValue="hello" />
            <div ref={ref} role="listbox" aria-label="Items" tabIndex={0} />
          </div>
        );
      }

      render(<EmptyListWithSearch />);

      const input = screen.getByRole("textbox", { name: "Search" }) as HTMLInputElement;
      input.focus();
      input.setSelectionRange(2, 2);

      for (const key of ["Home", "End"]) {
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        act(() => {
          input.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(false);
      }
      expect(onHighlightChange).not.toHaveBeenCalled();
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

    it("uses the composed target for an editable descendant in an open shadow root", async () => {
      function ListWithShadowInput() {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "option",
          defaultHighlighted: "a",
        });

        return (
          <div onKeyDown={result.onKeyDown}>
            <div
              data-testid="shadow-input-host"
              ref={(host) => {
                if (!host || host.shadowRoot) return;
                const input = document.createElement("input");
                input.setAttribute("aria-label", "Shadow search");
                host.attachShadow({ mode: "open" }).append(input);
              }}
            />
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

      render(<ListWithShadowInput />);
      const host = screen.getByTestId("shadow-input-host");
      const input = host.shadowRoot?.querySelector("input");
      expect(input).not.toBeNull();
      if (!input) return;
      input.focus();

      await userEvent.setup().keyboard("{ArrowDown}");

      expect(
        screen.getByRole("listbox", { name: "Items" }).getAttribute("aria-activedescendant"),
      ).toBe("item-a");
    });

    it("navigates from an editable open-shadow descendant of an owned item", async () => {
      function ListWithOwnedShadowInput() {
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
              <span
                data-testid="owned-shadow-input-host"
                ref={(host) => {
                  if (!host || host.shadowRoot) return;
                  const input = document.createElement("input");
                  input.setAttribute("aria-label", "Owned shadow input");
                  host.attachShadow({ mode: "open" }).append(input);
                }}
              />
            </div>
            <div id="item-b" role="option" data-value="b">
              B
            </div>
          </div>
        );
      }

      render(<ListWithOwnedShadowInput />);
      const input = screen
        .getByTestId("owned-shadow-input-host")
        .shadowRoot?.querySelector("input");
      expect(input).not.toBeNull();
      if (!input) return;
      input.focus();

      await userEvent.setup().keyboard("{ArrowDown}");

      expect(
        screen.getByRole("listbox", { name: "Items" }).getAttribute("aria-activedescendant"),
      ).toBe("item-b");
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

  it("does not diverge highlight from focus on native disabled controls in moveFocus mode", async () => {
    const onHighlightChange = vi.fn();
    function DisabledNativeList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        defaultHighlighted: "a",
        moveFocus: true,
        skipDisabled: false,
        onHighlightChange,
      });
      return (
        <div ref={ref} role="group" aria-label="Actions" tabIndex={0} onKeyDown={result.onKeyDown}>
          <button type="button" data-value="a">
            A
          </button>
          <button type="button" data-value="b" disabled>
            B
          </button>
        </div>
      );
    }

    render(<DisabledNativeList />);
    const first = screen.getByRole("button", { name: "A" });
    first.focus();

    const user = userEvent.setup();
    await user.keyboard("{ArrowDown}");

    expect(document.activeElement).toBe(first);
    expect(onHighlightChange).not.toHaveBeenCalled();
  });

  it("steps past a native disabled control in moveFocus mode to reach the next enabled item", async () => {
    const onHighlightChange = vi.fn();
    function DisabledMiddleList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        defaultHighlighted: "a",
        moveFocus: true,
        skipDisabled: false,
        wrap: false,
        onHighlightChange,
      });
      return (
        <div ref={ref} role="group" aria-label="Actions" tabIndex={0} onKeyDown={result.onKeyDown}>
          <button type="button" data-value="a">
            A
          </button>
          <button type="button" data-value="b" disabled>
            B
          </button>
          <button type="button" data-value="c">
            C
          </button>
        </div>
      );
    }

    render(<DisabledMiddleList />);
    const first = screen.getByRole("button", { name: "A" });
    const last = screen.getByRole("button", { name: "C" });
    first.focus();

    const user = userEvent.setup();
    await user.keyboard("{ArrowDown}");

    expect(document.activeElement).toBe(last);
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");
  });

  it("steps Home/End past native disabled edge controls in moveFocus mode", async () => {
    const onHighlightChange = vi.fn();
    function DisabledEdgeList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        moveFocus: true,
        skipDisabled: false,
        onHighlightChange,
      });
      return (
        <div ref={ref} role="group" aria-label="Actions" tabIndex={0} onKeyDown={result.onKeyDown}>
          <button type="button" data-value="a" disabled>
            A
          </button>
          <button type="button" data-value="b">
            B
          </button>
          <button type="button" data-value="c" disabled>
            C
          </button>
        </div>
      );
    }

    render(<DisabledEdgeList />);
    const middle = screen.getByRole("button", { name: "B" });
    middle.focus();

    const user = userEvent.setup();
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(middle);
    expect(onHighlightChange).toHaveBeenLastCalledWith("b");

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(middle);
    expect(onHighlightChange).toHaveBeenLastCalledWith("b");
  });

  describe("non-navigation control activation", () => {
    function EmptyListWithCreate({ onSelect }: { onSelect: (value: string) => void }) {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        onSelect,
      });
      return (
        <div onKeyDown={result.onKeyDown}>
          <button type="button">Create</button>
          <div ref={ref} role="listbox" aria-label="Items" tabIndex={0} />
        </div>
      );
    }

    it("does not suppress Enter/Space on a non-navigation button beside an empty list", () => {
      const onSelect = vi.fn();
      render(<EmptyListWithCreate onSelect={onSelect} />);

      const create = screen.getByRole("button", { name: "Create" });
      create.focus();

      for (const key of ["Enter", " "]) {
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        act(() => {
          create.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(false);
      }
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("does not suppress Home/End on a non-navigation button beside an empty list", () => {
      const onSelect = vi.fn();
      render(<EmptyListWithCreate onSelect={onSelect} />);

      const create = screen.getByRole("button", { name: "Create" });
      create.focus();

      for (const key of ["Home", "End"]) {
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        act(() => {
          create.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(false);
      }
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("does not suppress move keys on a non-navigation button beside an empty list", () => {
      const onSelect = vi.fn();
      render(<EmptyListWithCreate onSelect={onSelect} />);

      const create = screen.getByRole("button", { name: "Create" });
      create.focus();

      for (const key of ["ArrowUp", "ArrowDown"]) {
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        act(() => {
          create.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(false);
      }
      expect(onSelect).not.toHaveBeenCalled();
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
