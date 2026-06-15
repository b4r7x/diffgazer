// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MobileNavProvider, useMobileNav } from "@/hooks/mobile-nav-context";
import { SearchProvider, useSearchOpen } from "@/hooks/search-context";
import { stubMatchMedia } from "@/testing/match-media";
import { CommandRow } from "./command-row";

function SearchProbe() {
  const { open } = useSearchOpen();
  return <output aria-label="Search state">{open ? "open" : "closed"}</output>;
}

function RegisterSidebarProbe() {
  const { registerSidebar } = useMobileNav();
  return (
    <button type="button" onClick={() => registerSidebar()}>
      Register sidebar
    </button>
  );
}

describe("CommandRow", () => {
  it("opens search when the command row is clicked", async () => {
    stubMatchMedia({ isDesktop: true });
    const user = userEvent.setup();
    render(
      <MobileNavProvider>
        <SearchProvider>
          <SearchProbe />
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    expect(screen.getByRole("status", { name: "Search state" })).toHaveTextContent("closed");
    await user.click(screen.getByRole("button", { name: /^search docs, components, hooks/i }));
    expect(screen.getByRole("status", { name: "Search state" })).toHaveTextContent("open");
  });

  it("names the search button from its visible prompt and shows the / binding", () => {
    stubMatchMedia({ isDesktop: true });
    render(
      <MobileNavProvider>
        <SearchProvider>
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    const button = screen.getByRole("button", { name: /^search docs, components, hooks/i });
    expect(button).toHaveTextContent("search docs, components, hooks…");
    expect(button).toHaveTextContent("/");
    expect(button.textContent).not.toContain("⌘");

    expect(screen.getByText("[MODE: CMD]")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the mobile menu toggle only after a sidebar registers", async () => {
    stubMatchMedia({ isDesktop: false });
    const user = userEvent.setup();
    render(
      <MobileNavProvider>
        <SearchProvider>
          <RegisterSidebarProbe />
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    expect(screen.queryByRole("button", { name: /open navigation menu/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Register sidebar" }));

    expect(screen.getByRole("button", { name: /open navigation menu/i })).toBeInTheDocument();
  });
});
