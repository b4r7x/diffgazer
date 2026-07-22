// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/hooks/mobile-nav-context";
import { stubMatchMedia } from "@/testing/match-media";
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderLegalLayout(children: ReactNode) {
  return render(
    <KeyboardProvider>
      <MobileNavProvider>{children}</MobileNavProvider>
    </KeyboardProvider>,
  );
}

function BrokenLegalContent(): never {
  throw new Error("legal content chunk failed");
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

  it("keeps the legal layout available and offers reload when content rendering fails", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("location", { reload });

    renderLegalLayout(
      <LegalPageLayout panelLabel="PRIVACY">
        <BrokenLegalContent />
      </LegalPageLayout>,
    );

    expect(screen.getByText("[ LEGAL / PRIVACY ]")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Legal page unavailable" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reload" }));

    expect(reload).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
