import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Boundary mock: TanStack Router is the external routing library; home links need deterministic hrefs/current path.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock, ScriptOnceMock, useLocationMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    ScriptOnce: ScriptOnceMock,
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
});

describe("HomeView", () => {
  it("exposes an accessible Documentation heading", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Documentation" })).toBeInTheDocument();
  });

  it("renders the hero meta line", () => {
    renderHome();
    expect(screen.getByText(/version v\d+\.\d+\.\d+/i)).toBeInTheDocument();
    expect(screen.getByText(/registry r\.b4r7\.dev/i)).toBeInTheDocument();
  });

  it("renders the ascii wordmark hero", () => {
    renderHome();
    expect(screen.getByRole("img", { name: "diffgazer" })).toBeInTheDocument();
  });

  it("hides the decorative shell prompt above the registry directory", () => {
    renderHome();

    const prompt = screen.getByText("ls registry/");
    expect(prompt.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("lists packages in the registry directory", () => {
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
    expect(within(modules).getByText("CLI")).toBeInTheDocument();
  });

  it("describes what each package is next to its entry", () => {
    renderHome();

    expect(packageLink(/^diffgazer\b/i)).toHaveTextContent(
      "AI code review in your terminal. Local-first.",
    );
    expect(packageLink(/^@diffgazer\/ui\b/i)).toHaveTextContent(
      "Primitive & compound TUI building blocks.",
    );
    expect(packageLink(/^@diffgazer\/keys\b/i)).toHaveTextContent(
      "Headless keyboard, focus, & scope primitives.",
    );
  });

  it("renders a tree sidebar with library sections", () => {
    renderHome();

    const sidebar = screen.getByRole("navigation", { name: "Documentation tree" });
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
    expect(main).toHaveAttribute("data-scroll-restoration-id", "main-content");
    main.focus();
    expect(main).toHaveFocus();
  });

  it("moves the package highlight down with j and back up with k", async () => {
    const user = userEvent.setup();
    renderHome();

    const app = packageLink(/^diffgazer\b/i);
    const ui = packageLink(/^@diffgazer\/ui\b/i);
    const keys = packageLink(/^@diffgazer\/keys\b/i);
    expect(indicator(app)).toBe("›");

    app.focus();
    await user.keyboard("j");
    expect(indicator(ui)).toBe("▸");
    expect(indicator(app)).toBe("›");
    expect(ui).toHaveFocus();

    await user.keyboard("j");
    expect(indicator(keys)).toBe("▸");
    expect(indicator(ui)).toBe("›");

    await user.keyboard("k");
    expect(indicator(ui)).toBe("▸");
    expect(indicator(keys)).toBe("›");
    expect(ui).toHaveFocus();
  });

  it("activates the highlighted package link when Enter is pressed after j/k navigation", async () => {
    const user = userEvent.setup();
    renderHome();
    const app = packageLink(/^diffgazer\b/i);
    const ui = packageLink(/^@diffgazer\/ui\b/i);
    const onActivate = vi.fn((event: Event) => event.preventDefault());
    ui.addEventListener("click", onActivate);

    app.focus();
    await user.keyboard("j");
    await user.keyboard("{Enter}");

    expect(onActivate).toHaveBeenCalledOnce();
    expect(ui).toHaveAttribute("href", "/ui/getting-started/installation");
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
  });

  it("activates no package link on Enter when no package is highlighted", async () => {
    const user = userEvent.setup();
    renderHome();

    const onActivate = vi.fn((event: Event) => event.preventDefault());
    for (const link of screen.getAllByRole("link")) link.addEventListener("click", onActivate);

    await user.keyboard("{Enter}");
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("keeps Enter on an unrelated control native after a package is highlighted", async () => {
    const user = userEvent.setup();
    const onControlActivate = vi.fn();
    render(
      <KeyboardProvider>
        <button type="button" onClick={onControlActivate}>
          Unrelated control
        </button>
        <MobileNavProvider>
          <HomeView libraries={LIBRARIES} />
        </MobileNavProvider>
      </KeyboardProvider>,
    );

    const app = packageLink(/^diffgazer\b/i);
    const onPackageActivate = vi.fn((event: Event) => event.preventDefault());
    app.addEventListener("click", onPackageActivate);
    await user.hover(app);

    await user.click(screen.getByRole("button", { name: "Unrelated control" }));
    onControlActivate.mockClear();
    await user.keyboard("{Enter}");

    expect(onControlActivate).toHaveBeenCalledOnce();
    expect(onPackageActivate).not.toHaveBeenCalled();
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
