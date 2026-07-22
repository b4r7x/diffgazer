import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { testNavigationBehavior } from "../../testing/navigation-behavior.js";
import { useNavigation } from "../use-navigation.js";
import { expectActiveOptionText, focusListbox, itemId, TestList } from "./test-list.js";

describe("useNavigation", () => {
  describe("movement and discovery", () => {
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

    it("moves the active descendant without preventing the default when preventDefault is false", () => {
      render(<TestList defaultHighlighted="a" preventDefault={false} />);

      const listbox = screen.getByRole("listbox", { name: "Items" });
      listbox.focus();
      expect(listbox.getAttribute("aria-activedescendant")).toBe("item-a");

      const arrowDown = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        listbox.dispatchEvent(arrowDown);
      });

      expect(listbox.getAttribute("aria-activedescendant")).toBe("item-b");
      expect(arrowDown.defaultPrevented).toBe(false);
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
      expect(onNavigationBoundaryReached).toHaveBeenCalledTimes(1);
      expect(onNavigationBoundaryReached).toHaveBeenNthCalledWith(
        1,
        "next",
        expect.any(KeyboardEvent),
        "ArrowDown",
      );
      expectActiveOptionText("c");

      await user.keyboard("{ArrowUp}");
      expect(onNavigationBoundaryReached).toHaveBeenCalledTimes(1);
      expectActiveOptionText("b");

      await user.keyboard("{ArrowUp}");
      expect(onNavigationBoundaryReached).toHaveBeenCalledTimes(1);
      expectActiveOptionText("a");

      await user.keyboard("{ArrowUp}");
      expect(onNavigationBoundaryReached).toHaveBeenCalledTimes(2);
      expect(onNavigationBoundaryReached).toHaveBeenNthCalledWith(
        2,
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
          <div
            ref={ref}
            role="group"
            aria-label="Actions"
            tabIndex={0}
            onKeyDown={result.onKeyDown}
          >
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

    describe("nested owner scoping", () => {
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
            aria-activedescendant={
              result.highlighted === null ? undefined : itemId(result.highlighted)
            }
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

      await user.keyboard("{ArrowRight}");
      expectActiveOptionText("b");
      await user.keyboard("{ArrowLeft}");
      expectActiveOptionText("a");
      await user.keyboard("{ArrowDown}");
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
  });
});
