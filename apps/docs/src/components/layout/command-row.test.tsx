// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileNavProvider } from "@/lib/mobile-nav-context";
import { SearchProvider, useSearchOpen } from "@/lib/search-context";
import { CommandRow } from "./command-row";

function SearchProbe() {
  const { open } = useSearchOpen();
  return <span data-testid="search-state">{open ? "open" : "closed"}</span>;
}

function mockDesktopViewport() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("1024"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe("CommandRow", () => {
  it("opens search when the command row is clicked", () => {
    mockDesktopViewport();
    render(
      <MobileNavProvider>
        <SearchProvider>
          <SearchProbe />
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    expect(screen.getByTestId("search-state")).toHaveTextContent("closed");
    fireEvent.click(screen.getByRole("button", { name: /search documentation/i }));
    expect(screen.getByTestId("search-state")).toHaveTextContent("open");
  });
});
