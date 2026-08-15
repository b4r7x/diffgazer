import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WORDMARK_ASCII, WORDMARK_COLS, WORDMARK_ROWS } from "@/generated/logo-ascii";
import { ThemeProvider } from "@/hooks/theme-context";
import { StatusBar } from "./status-bar";

function renderStatusBar() {
  return render(
    <ThemeProvider>
      <StatusBar />
    </ThemeProvider>,
  );
}

const routerBoundary = vi.hoisted(() => ({ pathname: "/ui/components/button" }));

// Boundary mock: TanStack Router is the external routing library; this test controls location-derived active links.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    useRouterState: ({
      select,
    }: {
      select: (state: { location: { pathname: string } }) => unknown;
    }) => select({ location: { pathname: routerBoundary.pathname } }),
  };
});

describe("StatusBar", () => {
  it("marks the active library link with aria-current=page", () => {
    routerBoundary.pathname = "/ui/components/button";
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Components" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Docs" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Keys" })).not.toHaveAttribute("aria-current");
  });

  it("marks the Docs link active on app docs pages", () => {
    routerBoundary.pathname = "/app/getting-started";
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Components" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Keys" })).not.toHaveAttribute("aria-current");
  });

  it("marks no nav link active on the root path", () => {
    routerBoundary.pathname = "/";
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Docs" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Components" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Keys" })).not.toHaveAttribute("aria-current");
  });

  it.each([
    "/uix",
    "/application",
    "/keysmith",
  ])("marks no library link active on the root 404 path %s", (pathname) => {
    routerBoundary.pathname = pathname;
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Docs" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Components" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Keys" })).not.toHaveAttribute("aria-current");
  });

  it.each([
    ["/app", "Docs"],
    ["/ui", "Components"],
    ["/keys", "Keys"],
  ])("marks the exact library root %s active", (pathname, expectedName) => {
    routerBoundary.pathname = pathname;
    renderStatusBar();

    expect(screen.getByRole("link", { name: expectedName })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const activeLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(activeLinks).toHaveLength(1);
  });

  it("points each nav link at its library route", () => {
    routerBoundary.pathname = "/";
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("link", { name: "Components" })).toHaveAttribute("href", "/ui");
    expect(screen.getByRole("link", { name: "Keys" })).toHaveAttribute("href", "/keys");
    expect(screen.getByRole("button", { name: /^theme:/i })).toBeInTheDocument();
  });

  it("exposes focusable links inside the Site navigation landmark", async () => {
    const user = userEvent.setup();
    routerBoundary.pathname = "/";
    renderStatusBar();

    screen.getByRole("navigation", { name: "Site" });

    const tabOrder = [
      screen.getByRole("link", { name: "diffgazer" }),
      screen.getByRole("link", { name: "Docs" }),
      screen.getByRole("link", { name: "Components" }),
      screen.getByRole("link", { name: "Keys" }),
      screen.getByRole("link", { name: "GitHub" }),
      screen.getByRole("button", { name: /^theme:/i }),
    ];

    for (const element of tabOrder) {
      await user.tab();
      expect(element).toHaveFocus();
    }
  });
});

describe("generated wordmark grid", () => {
  // The bar reserves the scaled art as WORDMARK_COLS ch by WORDMARK_ROWS em, and
  // index.css reveals it in WORDMARK_ROWS animation steps. Both only hold while
  // the generated block really is that rectangle, so regenerating art of another
  // shape has to fail here rather than quietly desync the chrome.
  it("is WORDMARK_ROWS rows of WORDMARK_COLS columns", () => {
    const rows = WORDMARK_ASCII.split("\n");

    expect(rows).toHaveLength(WORDMARK_ROWS);
    for (const row of rows) {
      expect(row).toHaveLength(WORDMARK_COLS);
    }
  });

  // WORDMARK_ROWS and WORDMARK_ASCII come from the same figlet render, so the
  // shape test above is true at any height. The boot animation's hardcoded step
  // count is the value that actually desyncs, so pin it to the constant.
  it("reveals the boot animation in one step per generated row", async () => {
    const css = await readFile(resolve(import.meta.dirname, "../../index.css"), "utf8");

    expect(css).toContain(`steps(${WORDMARK_ROWS}, end)`);
  });
});
