import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useNavigation } from "../use-navigation.js";
import { expectActiveOptionText, focusListbox, itemId, TestList } from "./test-list.js";

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

describe("useNavigation", () => {
  describe("activation and state", () => {
    it("activates virtual highlighted item with Space and Enter on listbox", async () => {
      const onSelect = vi.fn();
      const onEnter = vi.fn();
      render(<TestList defaultHighlighted="b" onSelect={onSelect} onEnter={onEnter} />);
      const user = await focusListbox();

      await user.keyboard(" ");
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
      expect(onEnter).not.toHaveBeenCalled();

      onSelect.mockClear();
      await user.keyboard("{Enter}");
      expect(onEnter).toHaveBeenCalledTimes(1);
      expect(onEnter).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
      expect(onSelect).not.toHaveBeenCalled();
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

    it("preserves native Enter/Space activation when moveFocus is enabled without consumer handlers", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      function MoveFocusList() {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "button",
          defaultHighlighted: "a",
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
            <button
              type="button"
              data-value="a"
              onClick={(e) => onClick(e.currentTarget.dataset.value)}
            >
              A
            </button>
            <button
              type="button"
              data-value="b"
              onClick={(e) => onClick(e.currentTarget.dataset.value)}
            >
              B
            </button>
            <button
              type="button"
              data-value="c"
              onClick={(e) => onClick(e.currentTarget.dataset.value)}
            >
              C
            </button>
          </div>
        );
      }

      render(<MoveFocusList />);
      const first = screen.getByRole("button", { name: "A" });
      first.focus();

      await user.keyboard("{ArrowDown}{End}{Home}");
      expect(document.activeElement).toBe(first);

      await user.keyboard(" ");
      expect(onClick).toHaveBeenCalledWith("a");

      onClick.mockClear();
      await user.keyboard("{Enter}");
      expect(onClick).toHaveBeenCalledWith("a");
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
          <div
            ref={ref}
            role="group"
            aria-label="Actions"
            tabIndex={0}
            onKeyDown={result.onKeyDown}
          >
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

        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        });
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

        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        });
        listbox.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(onEnter).toHaveBeenCalledWith("a", expect.any(KeyboardEvent));
      });
    });
  });
});
