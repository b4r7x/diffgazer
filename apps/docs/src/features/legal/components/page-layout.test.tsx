// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/hooks/mobile-nav-context";
import { stubMatchMedia } from "@/testing/match-media";
import { LegalSidebar } from "./legal-sidebar";
import { LegalPageLayout } from "./page-layout";

// Boundary mock: TanStack Router is the external routing library; legal links/current path are controlled here.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock, useLocationMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    ...useLocationMock({ pathname: "/privacy" }),
  };
});

beforeEach(() => {
  stubMatchMedia({ isDesktop: true });
  Element.prototype.scrollIntoView = () => {};
});

function renderLegalLayout(children: ReactNode) {
  return render(
    <KeyboardProvider>
      <MobileNavProvider>{children}</MobileNavProvider>
    </KeyboardProvider>,
  );
}

describe("LegalPageLayout", () => {
  it("renders the panel label and child content", () => {
    renderLegalLayout(
      <LegalPageLayout panelLabel="PRIVACY">
        <h1>Privacy policy</h1>
      </LegalPageLayout>,
    );

    expect(screen.getByText("[ LEGAL / PRIVACY ]")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Privacy policy" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("makes the main content region programmatically focusable", () => {
    renderLegalLayout(
      <LegalPageLayout panelLabel="PRIVACY">
        <p>Body</p>
      </LegalPageLayout>,
    );

    const main = screen.getByRole("main");
    main.focus();
    expect(main).toHaveFocus();
  });
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
