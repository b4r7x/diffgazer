// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
      select({ pathname: "/" }),
  };
});

import { MobileNavProvider } from "@/lib/mobile-nav-context";
import { stubMatchMedia } from "@/testing/match-media";
import type { HomeLibrary } from "../data";
import { HomeView } from "./view";

const LIBRARIES: HomeLibrary[] = [
  {
    id: "app",
    displayName: "diffgazer",
    sections: [
      {
        name: "Getting Started",
        splat: "getting-started/installation",
        count: 4,
      },
      { name: "Product", splat: "story", count: 4 },
      { name: "Concepts", splat: "concepts/overview", count: 3 },
      { name: "Web Mode", splat: "web/overview", count: 2 },
      { name: "Terminal UI", splat: "tui/overview", count: 2 },
      { name: "Reference", splat: "reference/overview", count: 5 },
      { name: "Registry CLI", splat: "cli/dgadd", count: 6 },
      { name: "Operations", splat: "operations/overview", count: 2 },
    ],
  },
  {
    id: "ui",
    displayName: "@diffgazer/ui",
    sections: [
      {
        name: "Getting Started",
        splat: "getting-started/installation",
        count: 5,
      },
      { name: "Components", splat: "components/button", count: 47 },
      { name: "Hooks", splat: "hooks/listbox", count: 11 },
    ],
  },
  {
    id: "keys",
    displayName: "@diffgazer/keys",
    sections: [
      {
        name: "Getting Started",
        splat: "getting-started/installation",
        count: 3,
      },
      { name: "Hooks", splat: "hooks/use-key", count: 9 },
    ],
  },
];

function renderHome() {
  return render(
    <MobileNavProvider>
      <HomeView libraries={LIBRARIES} />
    </MobileNavProvider>,
  );
}

beforeEach(() => {
  stubMatchMedia({ isDesktop: true });
  Element.prototype.scrollIntoView = () => {};
});

describe("HomeView", () => {
  it("exposes an accessible Documentation heading", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Documentation" })).toBeInTheDocument();
  });

  it("renders the SYS_INFO status block", () => {
    renderHome();
    expect(screen.getByText("STATUS:")).toBeInTheDocument();
    expect(screen.getByText("OPERATIONAL")).toBeInTheDocument();
    expect(screen.getByText(/REGISTRY:/)).toBeInTheDocument();
  });

  it("lists packages in the modules index table", () => {
    renderHome();

    const modules = screen.getByRole("navigation", { name: "Documentation packages" });
    expect(within(modules).getByRole("link", { name: /^diffgazer\b/i })).toHaveAttribute(
      "href",
      "/app/getting-started/installation",
    );
    expect(within(modules).getByRole("link", { name: /^@diffgazer\/ui\b/i })).toHaveAttribute(
      "href",
      "/ui/getting-started/installation",
    );
    expect(within(modules).getByText("47 Comp")).toBeInTheDocument();
    expect(within(modules).getByText("9 Hooks")).toBeInTheDocument();
  });

  it("renders a tree sidebar with library sections", () => {
    renderHome();

    const sidebar = screen.getByRole("navigation", { name: "Primary" });
    expect(within(sidebar).getByRole("heading", { name: "@diffgazer/ui" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /Components \(47\)/i })).toHaveAttribute(
      "href",
      "/ui/components/button",
    );
  });

  it("places the page h1 before the sidebar section headings in DOM order", () => {
    renderHome();

    const h1 = screen.getByRole("heading", { level: 1, name: "Documentation" });
    const h3s = screen.getAllByRole("heading", { level: 3 });
    expect(h3s.length).toBeGreaterThan(0);
    for (const h3 of h3s) {
      expect(h1.compareDocumentPosition(h3) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("hides the decorative END OF DIRECTORY divider from assistive tech", () => {
    renderHome();

    const modules = screen.getByRole("navigation", { name: "Documentation packages" });
    const divider = within(modules).getByText("END OF DIRECTORY");
    expect(divider.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("makes the main content region programmatically focusable", () => {
    renderHome();

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    main.focus();
    expect(main).toHaveFocus();
  });

  it("lets the main column scroll below lg while keeping the fixed layout at lg", () => {
    renderHome();

    const main = screen.getByRole("main");
    expect(main.className).toContain("overflow-y-auto");
    expect(main.className).toContain("lg:overflow-hidden");
  });
});
