import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useNavigation } from "../use-navigation.js";
import { itemId } from "./test-list.js";

describe("useNavigation", () => {
  describe("editable and native focus", () => {
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

    it("steps Home/End past native disabled edge controls to the first/last enabled item in moveFocus mode", async () => {
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
          <div
            ref={ref}
            role="group"
            aria-label="Actions"
            tabIndex={0}
            onKeyDown={result.onKeyDown}
          >
            <button type="button" data-value="a" disabled>
              A
            </button>
            <button type="button" data-value="b">
              B
            </button>
            <button type="button" data-value="c">
              C
            </button>
            <button type="button" data-value="d">
              D
            </button>
            <button type="button" data-value="e" disabled>
              E
            </button>
          </div>
        );
      }

      render(<DisabledEdgeList />);
      const first = screen.getByRole("button", { name: "B" });
      const middle = screen.getByRole("button", { name: "C" });
      const last = screen.getByRole("button", { name: "D" });
      middle.focus();

      const user = userEvent.setup();
      onHighlightChange.mockClear();
      await user.keyboard("{Home}");
      expect(document.activeElement).toBe(first);
      expect(onHighlightChange).toHaveBeenCalledTimes(1);
      expect(onHighlightChange).toHaveBeenLastCalledWith("b");

      middle.focus();
      onHighlightChange.mockClear();
      await user.keyboard("{End}");
      expect(document.activeElement).toBe(last);
      expect(onHighlightChange).toHaveBeenCalledTimes(1);
      expect(onHighlightChange).toHaveBeenLastCalledWith("d");
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
  });
});
