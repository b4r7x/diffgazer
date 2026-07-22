import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  type UseNavigationOptions,
  type UseNavigationReturn,
  useNavigation,
} from "../use-navigation.js";
import { itemId } from "./test-list.js";

describe("useNavigation", () => {
  describe("validation and types", () => {
    describe("role-only items without data-value", () => {
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
});
