import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import { describe, expect, it, vi } from "vitest";
import { useFooterNavigation } from "./use-footer-navigation";

type FooterNavigationOptions = Parameters<typeof useFooterNavigation>[0];

function TestFooterNavigation({ options }: { options: FooterNavigationOptions }) {
  const footer = useFooterNavigation(options);

  return (
    <div>
      <span data-testid="footer-zone">{footer.inFooter ? "footer" : "content"}</span>
      <span data-testid="focused-index">{footer.focusedIndex}</span>
      <button type="button" {...footer.getButtonProps(0)}>Cancel</button>
      <button type="button" {...footer.getButtonProps(1)}>Save</button>
    </div>
  );
}

function renderFooterNavigation(overrides: Partial<FooterNavigationOptions> = {}) {
  const onAction = vi.fn();
  const user = userEvent.setup();

  render(
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

  return { onAction, user };
}

function focusedIndex() {
  return screen.getByTestId("focused-index").textContent;
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
    expect(focusedIndex()).toBe("0");

    await user.keyboard("{ArrowRight}{Enter}");
    expect(focusedIndex()).toBe("1");
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    expect(onAction).toHaveBeenLastCalledWith(1);

    await user.keyboard("{ArrowLeft}{Enter}");
    expect(focusedIndex()).toBe("0");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(onAction).toHaveBeenLastCalledWith(0);
  });

  it("enters the footer from content and focuses the first action before activation", async () => {
    const { onAction, user } = renderFooterNavigation({ defaultZone: "content" });

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(focusedIndex()).toBe("0");

    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith(0);
  });

  it("clamps at footer boundaries unless wrapping is enabled", async () => {
    const { user } = renderFooterNavigation();

    await user.keyboard("{ArrowLeft}");
    expect(focusedIndex()).toBe("0");

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(focusedIndex()).toBe("1");
  });

  it("wraps footer arrow navigation when requested", async () => {
    const { user } = renderFooterNavigation({ wrap: true });

    await user.keyboard("{ArrowLeft}");
    expect(focusedIndex()).toBe("1");

    await user.keyboard("{ArrowRight}");
    expect(focusedIndex()).toBe("0");
  });
});
