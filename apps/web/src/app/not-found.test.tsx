import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotFoundPage } from "./not-found";

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mockNavigate }));

function EscapeHintProbe() {
  const { rightShortcuts } = useFooterData();
  return (
    <output>
      {rightShortcuts.map((shortcut) => `${shortcut.key}:${shortcut.label}`).join("|")}
    </output>
  );
}

function renderNotFound() {
  mockNavigate.mockClear();
  render(
    <FooterProvider>
      <KeyboardProvider>
        <NotFoundPage />
        <EscapeHintProbe />
      </KeyboardProvider>
    </FooterProvider>,
  );
}

describe("NotFoundPage", () => {
  it("renders a single centered action", () => {
    renderNotFound();

    const actions = screen.getAllByRole("button");
    expect(actions).toHaveLength(1);
    expect(actions[0]).toHaveAccessibleName("Go to Home");
  });

  it("takes Escape home instead of reloading the missing route", async () => {
    const user = userEvent.setup();
    renderNotFound();

    // Reloading a route that does not exist re-fetches the same 404, so the
    // reload affordance is gone from both the action row and the Esc hint.
    expect(screen.queryByRole("button", { name: /reload/i })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Esc:Home");

    await user.keyboard("{Escape}");

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });
});
