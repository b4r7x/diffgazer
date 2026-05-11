import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import { describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useFooterNavigation } from "./use-footer-navigation";

type FooterNavigationOptions = Parameters<typeof useFooterNavigation>[0];

function TestFooterNavigation({ options }: { options: FooterNavigationOptions }) {
  const fallbackRef = useRef<HTMLDivElement>(null);
  const footer = useFooterNavigation({
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
        {...footer.getButtonProps(0)}
        onClick={() => handleClick(0)}
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={disabledActions[1]}
        {...footer.getButtonProps(1)}
        onClick={() => handleClick(1)}
      >
        Save
      </button>
    </div>
  );
}

function renderFooterNavigation(overrides: Partial<FooterNavigationOptions> = {}) {
  const onAction = vi.fn();
  const user = userEvent.setup();

  const view = render(
    <KeyboardProvider>
      <TestFooterNavigation
        options={{
          enabled: true,
          buttonCount: 2,
          defaultZone: "footer",
          onAction,
          ...overrides,
        }}
      />
    </KeyboardProvider>,
  );

  const rerenderFooterNavigation = (nextOverrides: Partial<FooterNavigationOptions>) => {
    view.rerender(
      <KeyboardProvider>
        <TestFooterNavigation
          options={{
            enabled: true,
            buttonCount: 2,
            defaultZone: "footer",
            onAction,
            ...overrides,
            ...nextOverrides,
          }}
        />
      </KeyboardProvider>,
    );
  };

  return { onAction, rerenderFooterNavigation, user };
}

describe("useFooterNavigation", () => {
  it("focuses the default footer action when the footer is the initial zone", async () => {
    renderFooterNavigation();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });
  });

  it("moves between footer actions and activates the focused action", async () => {
    const { onAction, user } = renderFooterNavigation();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}{Enter}");
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    expect(onAction).toHaveBeenLastCalledWith(1);

    await user.keyboard("{ArrowLeft}{Enter}");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(onAction).toHaveBeenLastCalledWith(0);
  });

  it("enters the footer from content and focuses the first action before activation", async () => {
    const { onAction, user } = renderFooterNavigation({ defaultZone: "content" });

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith(0);
  });

  it("clamps at footer boundaries unless wrapping is enabled", async () => {
    const { user } = renderFooterNavigation();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  it("wraps footer arrow navigation when requested", async () => {
    const { user } = renderFooterNavigation({ wrap: true });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("skips disabled footer actions during arrow navigation", async () => {
    const { onAction, user } = renderFooterNavigation({ disabledActions: [false, true] });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith(0);
    expect(onAction).not.toHaveBeenCalledWith(1);
  });

  it("enters the footer on the first enabled action when the first button is disabled", async () => {
    const { user } = renderFooterNavigation({
      defaultZone: "content",
      disabledActions: [true, false],
    });

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  it("does not enter the footer when every action is disabled", async () => {
    const { user } = renderFooterNavigation({
      defaultZone: "content",
      disabledActions: [true, true],
    });
    const fallback = screen.getByLabelText("Content fallback");
    fallback.focus();

    await user.keyboard("{ArrowDown}");

    expect(fallback).toHaveFocus();
    expect(screen.getByRole("button", { name: "Cancel" })).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "Save" })).not.toHaveFocus();
  });

  it("moves from a focused action to the next enabled action when that action becomes disabled", async () => {
    const { onAction, rerenderFooterNavigation, user } = renderFooterNavigation({ defaultIndex: 1 });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    });

    rerenderFooterNavigation({ defaultIndex: 1, disabledActions: [false, true] });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith(0);
    expect(onAction).not.toHaveBeenCalledWith(1);
  });

  it("uses the fallback while every action is disabled and enters the next enabled action on request", async () => {
    const { onAction, rerenderFooterNavigation, user } = renderFooterNavigation({ defaultIndex: 1 });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    });

    rerenderFooterNavigation({ defaultIndex: 1, disabledActions: [true, true] });

    await waitFor(() => {
      expect(screen.getByLabelText("Content fallback")).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    expect(onAction).not.toHaveBeenCalled();

    rerenderFooterNavigation({ defaultIndex: 1, disabledActions: [true, false] });
    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith(1);
  });
});
