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
  it("renders the band as a page-level region with an announced h1", () => {
    renderNotFound();

    const region = screen.getByRole("region", { name: "Page Not Found" });
    const heading = screen.getByRole("heading", { level: 1, name: "Page Not Found" });
    expect(region).toContainElement(heading);
    // The announcement wraps the heading rather than replacing its role.
    expect(screen.getByRole("alert")).toContainElement(heading);
  });

  it("names the status art 404 and keeps the glyph rows out of the accessible name", () => {
    renderNotFound();

    const art = screen.getByRole("img", { name: "404" });
    expect(art).toHaveAccessibleName("404");
  });

  it("reads the attempted route back as a labelled readout", () => {
    window.history.pushState({}, "", "/this-route-does-not-exist");
    renderNotFound();

    expect(screen.getByText("route")).toBeInTheDocument();
    expect(screen.getByText("/this-route-does-not-exist")).toBeInTheDocument();
  });

  it("renders a single action that goes home", async () => {
    const user = userEvent.setup();
    renderNotFound();

    const actions = screen.getAllByRole("button");
    expect(actions).toHaveLength(1);
    expect(actions[0]).toHaveAccessibleName("Go to Home");

    await user.click(actions[0] as HTMLElement);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("focuses the lone action on mount so Enter goes home immediately", async () => {
    const user = userEvent.setup();
    renderNotFound();

    expect(screen.getByRole("button", { name: "Go to Home" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
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
