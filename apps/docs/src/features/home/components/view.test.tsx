// @vitest-environment jsdom

import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

// Boundary mock: TanStack Router is the external routing library; home links need deterministic hrefs/current path.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock, useLocationMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    useNavigate: () => navigate,
    ...useLocationMock({ pathname: "/" }),
  };
});

import { MobileNavProvider } from "@/hooks/mobile-nav-context";
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
    <KeyboardProvider>
      <MobileNavProvider>
        <HomeView libraries={LIBRARIES} />
      </MobileNavProvider>
    </KeyboardProvider>,
  );
}

function packageLink(name: RegExp): HTMLElement {
  const modules = screen.getByRole("navigation", { name: "Documentation packages" });
  return within(modules).getByRole("link", { name });
}

function indicator(link: HTMLElement): string {
  return within(link).getByText(/^[▸›]$/).textContent ?? "";
}

beforeEach(() => {
  stubMatchMedia({ isDesktop: true });
  Element.prototype.scrollIntoView = () => {};
  navigate.mockClear();
});

describe("HomeView", () => {
  it("exposes an accessible Documentation heading", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Documentation" })).toBeInTheDocument();
  });

  it("renders the SYS_INFO status block", () => {
    renderHome();
    expect(screen.getByText("STATUS:")).toBeInTheDocument();
    expect(screen.getByText("ONLINE")).toBeInTheDocument();
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

  it("follows the page h1 with level-two sidebar section headings", () => {
    renderHome();

    expect(screen.getAllByRole("heading").map((heading) => heading.tagName)).toEqual([
      "H1",
      "H2",
      "H2",
      "H2",
    ]);
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

  it("moves the package highlight down with j and back up with k", async () => {
    const user = userEvent.setup();
    renderHome();

    const app = packageLink(/^diffgazer\b/i);
    const ui = packageLink(/^@diffgazer\/ui\b/i);
    expect(indicator(app)).toBe("›");

    await user.keyboard("j");
    expect(indicator(app)).toBe("▸");

    await user.keyboard("j");
    expect(indicator(ui)).toBe("▸");
    expect(indicator(app)).toBe("›");

    await user.keyboard("k");
    expect(indicator(app)).toBe("▸");
    expect(indicator(ui)).toBe("›");
  });

  it("activates the focused package link with native Enter behavior", async () => {
    const user = userEvent.setup();
    renderHome();
    const app = packageLink(/^diffgazer\b/i);
    const onActivate = vi.fn((event: Event) => event.preventDefault());
    app.addEventListener("click", onActivate);

    app.focus();
    await user.keyboard("{Enter}");

    expect(onActivate).toHaveBeenCalledOnce();
    expect(app).toHaveAttribute("href", "/app/getting-started/installation");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not navigate on Enter when no package is highlighted", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.keyboard("{Enter}");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("highlights a package row on hover", async () => {
    const user = userEvent.setup();
    renderHome();

    const ui = packageLink(/^@diffgazer\/ui\b/i);
    await user.hover(ui);
    expect(indicator(ui)).toBe("▸");
  });

  it("ignores j while typing in an editable field", async () => {
    const user = userEvent.setup();
    render(
      <KeyboardProvider>
        <MobileNavProvider>
          <input aria-label="probe" />
          <HomeView libraries={LIBRARIES} />
        </MobileNavProvider>
      </KeyboardProvider>,
    );

    const probe = screen.getByRole("textbox", { name: "probe" });
    await user.click(probe);
    await user.keyboard("j");

    expect(indicator(packageLink(/^diffgazer\b/i))).toBe("›");
    expect(probe).toHaveValue("j");
  });
});
