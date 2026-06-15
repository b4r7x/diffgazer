import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { testNavigationBehavior } from "../testing/navigation-behavior.js";
import { KeyboardWrapper } from "../testing/test-utils.js";
import {
  type UseActionRowNavigationOptions,
  type UseActionRowNavigationReturn,
  useActionRowNavigation,
} from "./use-action-row-navigation.js";

function getActionRowActiveIndex(): number {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return -1;
  if (active.textContent?.trim() === "Cancel") return 0;
  if (active.textContent?.trim() === "Save") return 1;
  return -1;
}

function TestActionRow({ options }: { options: UseActionRowNavigationOptions }) {
  const fallbackRef = useRef<HTMLDivElement>(null);
  const row = useActionRowNavigation({
    disabledFocusFallbackRef: fallbackRef,
    ...options,
  });
  const disabledActions = options.disabledActions ?? [];
  const handleClick = (index: number) => {
    if (!disabledActions[index]) options.onAction(index);
  };

  return (
    <div>
      <div ref={fallbackRef} tabIndex={-1} aria-label="Content fallback">
        Content
      </div>
      <button
        type="button"
        disabled={disabledActions[0]}
        {...row.getActionProps(0)}
        onClick={() => handleClick(0)}
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={disabledActions[1]}
        {...row.getActionProps(1)}
        onClick={() => handleClick(1)}
      >
        Save
      </button>
    </div>
  );
}

function renderActionRow(overrides: Partial<UseActionRowNavigationOptions> = {}) {
  const onAction = vi.fn();
  const onNavigate = vi.fn();
  const onBoundary = vi.fn();
  const user = userEvent.setup();

  const view = render(
    <KeyboardWrapper>
      <TestActionRow
        options={{
          enabled: true,
          actionCount: 2,
          defaultZone: "actions",
          onAction,
          onNavigate,
          onNavigationBoundaryReached: onBoundary,
          ...overrides,
        }}
      />
    </KeyboardWrapper>,
  );

  const rerenderActionRow = (nextOverrides: Partial<UseActionRowNavigationOptions>) => {
    view.rerender(
      <KeyboardWrapper>
        <TestActionRow
          options={{
            enabled: true,
            actionCount: 2,
            defaultZone: "actions",
            onAction,
            onNavigate,
            onNavigationBoundaryReached: onBoundary,
            ...overrides,
            ...nextOverrides,
          }}
        />
      </KeyboardWrapper>,
    );
  };

  return { onAction, onNavigate, onBoundary, rerenderActionRow, user };
}

function getButton(name: string) {
  return screen.getByRole("button", { name });
}

function expectFocused(el: HTMLElement) {
  expect(document.activeElement).toBe(el);
}

describe("useActionRowNavigation", () => {
  describe("arrow navigation within the actions zone", () => {
    testNavigationBehavior({
      setup: () => {
        const onAction = vi.fn();
        const onNavigate = vi.fn();
        const onBoundary = vi.fn();
        return render(
          <KeyboardWrapper>
            <TestActionRow
              options={{
                enabled: true,
                actionCount: 2,
                defaultZone: "actions",
                wrap: true,
                onAction,
                onNavigate,
                onNavigationBoundaryReached: onBoundary,
              }}
            />
          </KeyboardWrapper>,
        );
      },
      items: ["Cancel", "Save"],
      initialActive: 0,
      cases: [
        { key: "{ArrowRight}", expectedActiveIndex: 1, label: "ArrowRight" },
        {
          key: "{ArrowRight}{ArrowRight}",
          expectedActiveIndex: 0,
          label: "ArrowRight ArrowRight (wraps)",
        },
        { key: "{ArrowLeft}", expectedActiveIndex: 1, label: "ArrowLeft (wraps from start)" },
      ],
      getActiveIndex: getActionRowActiveIndex,
    });
  });

  it("focuses the default action when actions is the initial zone", async () => {
    renderActionRow();

    await waitFor(() => {
      expectFocused(getButton("Cancel"));
    });
  });

  it("moves between actions and activates the focused action", async () => {
    const { onAction, user } = renderActionRow();

    await waitFor(() => expectFocused(getButton("Cancel")));

    await user.keyboard("{ArrowRight}{Enter}");
    expectFocused(getButton("Save"));
    expect(onAction).toHaveBeenLastCalledWith(1);

    await user.keyboard("{ArrowLeft}{Enter}");
    expectFocused(getButton("Cancel"));
    expect(onAction).toHaveBeenLastCalledWith(0);
  });

  it("enters actions from content and focuses the first action", async () => {
    const { onAction, user } = renderActionRow({ defaultZone: "content" });

    await user.keyboard("{ArrowDown}");
    expectFocused(getButton("Cancel"));

    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith(0);
  });

  it("clamps at boundaries unless wrapping is enabled", async () => {
    const { user } = renderActionRow();

    await waitFor(() => expectFocused(getButton("Cancel")));

    await user.keyboard("{ArrowLeft}");
    expectFocused(getButton("Cancel"));

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expectFocused(getButton("Save"));
  });

  it("wraps navigation when requested", async () => {
    const { user } = renderActionRow({ wrap: true });

    await waitFor(() => expectFocused(getButton("Cancel")));

    await user.keyboard("{ArrowLeft}");
    expectFocused(getButton("Save"));

    await user.keyboard("{ArrowRight}");
    expectFocused(getButton("Cancel"));
  });

  it("skips disabled actions during navigation", async () => {
    const { onAction, user } = renderActionRow({ disabledActions: [false, true] });

    await waitFor(() => expectFocused(getButton("Cancel")));

    await user.keyboard("{ArrowRight}");
    expectFocused(getButton("Cancel"));

    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith(0);
    expect(onAction).not.toHaveBeenCalledWith(1);
  });

  it("enters on the first enabled action when the first is disabled", async () => {
    const { user } = renderActionRow({
      defaultZone: "content",
      disabledActions: [true, false],
    });

    await user.keyboard("{ArrowDown}");
    expectFocused(getButton("Save"));
  });

  it("does not enter actions when every action is disabled", async () => {
    const { user } = renderActionRow({
      defaultZone: "content",
      disabledActions: [true, true],
    });
    const fallback = screen.getByLabelText("Content fallback");
    fallback.focus();

    await user.keyboard("{ArrowDown}");

    expectFocused(fallback);
  });

  it("moves to the next enabled action when a focused action becomes disabled", async () => {
    const { onAction, rerenderActionRow, user } = renderActionRow({ defaultIndex: 1 });

    await waitFor(() => expectFocused(getButton("Save")));

    rerenderActionRow({ defaultIndex: 1, disabledActions: [false, true] });

    await waitFor(() => expectFocused(getButton("Cancel")));

    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith(0);
    expect(onAction).not.toHaveBeenCalledWith(1);
  });

  it("calls onNavigate when navigating between actions", async () => {
    const { onNavigate, user } = renderActionRow();

    await waitFor(() => expectFocused(getButton("Cancel")));

    await user.keyboard("{ArrowRight}");
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("calls onNavigationBoundaryReached at boundaries without wrap", async () => {
    const { onBoundary, user } = renderActionRow();

    await waitFor(() => expectFocused(getButton("Cancel")));

    await user.keyboard("{ArrowLeft}");
    expect(onBoundary).toHaveBeenCalledWith("previous");

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(onBoundary).toHaveBeenCalledWith("next");
  });

  it("calls onNavigationBoundaryReached when exiting via ArrowUp", async () => {
    const { onBoundary, user } = renderActionRow();

    await waitFor(() => expectFocused(getButton("Cancel")));

    await user.keyboard("{ArrowUp}");
    expect(onBoundary).toHaveBeenCalledWith("previous");
  });

  it("activates focused action with Space", async () => {
    const { onAction, user } = renderActionRow();

    await waitFor(() => expectFocused(getButton("Cancel")));

    await user.keyboard("{ArrowRight}");
    await user.keyboard(" ");
    expect(onAction).toHaveBeenCalledWith(1);
  });

  it("fires onAction even when DOM focus is already on the target button", async () => {
    const { onAction, user } = renderActionRow();

    await waitFor(() => expectFocused(getButton("Cancel")));

    // Focus is already on the Cancel button via the action row navigation.
    // Enter should still fire onAction.
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith(0);
  });

  describe("types", () => {
    it("narrows index and disabledActions when Actions tuple is provided", () => {
      type TwoActions = readonly [() => void, () => void];
      type Options = UseActionRowNavigationOptions<TwoActions>;

      expectTypeOf<Options["actionCount"]>().toEqualTypeOf<2>();
      expectTypeOf<NonNullable<Options["disabledActions"]>>().toEqualTypeOf<
        readonly [boolean, boolean]
      >();
      // Tuple index narrowing: onAction/onNavigate accept only 0 | 1 (not number).
      // We assert by checking that number is NOT assignable to the parameter.
      expectTypeOf<number>().not.toMatchTypeOf<Parameters<Options["onAction"]>[0]>();
      expectTypeOf<0>().toMatchTypeOf<Parameters<Options["onAction"]>[0]>();
      expectTypeOf<1>().toMatchTypeOf<Parameters<Options["onAction"]>[0]>();
      expectTypeOf<2>().not.toMatchTypeOf<Parameters<Options["onAction"]>[0]>();
      expectTypeOf<number>().not.toMatchTypeOf<Parameters<NonNullable<Options["onNavigate"]>>[0]>();
    });

    it("rejects disabledActions whose length does not match Actions", () => {
      type ThreeActions = readonly [() => void, () => void, () => void];

      expectTypeOf<readonly [boolean, boolean]>().not.toMatchTypeOf<
        NonNullable<UseActionRowNavigationOptions<ThreeActions>["disabledActions"]>
      >();
    });

    it("rejects actionCount that disagrees with Actions length", () => {
      type ThreeActions = readonly [() => void, () => void, () => void];

      expectTypeOf<2>().not.toMatchTypeOf<
        UseActionRowNavigationOptions<ThreeActions>["actionCount"]
      >();
    });

    it("keeps the loose default contract when no generic is supplied", () => {
      expectTypeOf<UseActionRowNavigationOptions["actionCount"]>().toEqualTypeOf<number>();
      expectTypeOf<UseActionRowNavigationOptions["onAction"]>()
        .parameter(0)
        .toEqualTypeOf<number>();
      expectTypeOf<NonNullable<UseActionRowNavigationOptions["disabledActions"]>>().toEqualTypeOf<
        readonly boolean[]
      >();
    });

    it("narrows the return value index parameters for tuple instantiations", () => {
      type ThreeActions = readonly [() => void, () => void, () => void];
      type Return = UseActionRowNavigationReturn<ThreeActions>;

      // focusedIndex is narrowed to the tuple's valid indices, not bare number.
      expectTypeOf<Return["focusedIndex"]>().toEqualTypeOf<0 | 1 | 2>();
      expectTypeOf<Return["getActionProps"]>().parameter(0).toEqualTypeOf<0 | 1 | 2>();
      expectTypeOf<Return["enterActions"]>().parameter(0).toEqualTypeOf<0 | 1 | 2 | undefined>();

      // Type-only: never executed, so the out-of-range calls only need to fail
      // type-checking (the @ts-expect-error comments assert that).
      function _typeAssertions(row: Return) {
        row.getActionProps(0);
        row.getActionProps(2);
        // @ts-expect-error getActionProps rejects out-of-range tuple indices.
        row.getActionProps(7);
        // @ts-expect-error enterActions rejects out-of-range tuple indices.
        row.enterActions(7);
        // @ts-expect-error reset rejects out-of-range tuple indices.
        row.reset(7);
      }
      void _typeAssertions;
    });

    it("keeps return index parameters as number for array instantiations", () => {
      expectTypeOf<UseActionRowNavigationReturn["focusedIndex"]>().toEqualTypeOf<number>();
      expectTypeOf<UseActionRowNavigationReturn["getActionProps"]>()
        .parameter(0)
        .toEqualTypeOf<number>();
    });
  });
});
