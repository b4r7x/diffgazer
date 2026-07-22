// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LegalSidebar } from "./legal-sidebar";

// Boundary mock: TanStack Router is the external routing library; legal links/current path are controlled here.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock, useLocationMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    ...useLocationMock({ pathname: "/privacy" }),
  };
});

describe("LegalSidebar", () => {
  it("renders Home and the legal links", () => {
    render(<LegalSidebar />);

    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Privacy/ })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /Terms/ })).toHaveAttribute("href", "/terms");
  });

  it("calls onNavigate when a sidebar link is clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<LegalSidebar onNavigate={onNavigate} />);

    await user.click(screen.getByRole("link", { name: /Terms/ }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not call onNavigate for a modifier click", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<LegalSidebar onNavigate={onNavigate} />);

    await user.keyboard("{Meta>}");
    await user.click(screen.getByRole("link", { name: /Terms/ }));
    await user.keyboard("{/Meta}");

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
