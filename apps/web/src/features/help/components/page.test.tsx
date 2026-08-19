import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { HelpPage } from "./page";

function Providers({ children }: { children: ReactNode }) {
  return (
    <FooterProvider>
      <KeyboardProvider>{children}</KeyboardProvider>
    </FooterProvider>
  );
}

// A real memory router instead of a module mock: Escape's contract is "go back
// to the screen help was opened from", which only an actual history stack can
// prove. Paths must exist in the production route tree: Register types
// navigate against it.
function createHelpRouter(initialEntries: string[]) {
  const rootRoute = createRootRoute({ component: Outlet });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>home screen</div>,
  });
  const historyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/history",
    component: () => <div>history screen</div>,
  });
  const helpRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/help",
    component: HelpPage,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([homeRoute, historyRoute, helpRoute]),
    history: createMemoryHistory({ initialEntries }),
  });
}

async function renderPage() {
  const router = createHelpRouter(["/help"]);
  const result = render(<RouterProvider router={router} />, { wrapper: Providers });
  await screen.findByRole("heading", { level: 1, name: "Help" });
  return { router, ...result };
}

describe("HelpPage", () => {
  it("names the panel region with the single visible Help title", async () => {
    await renderPage();

    expect(screen.getByRole("region", { name: /^help$/i })).toBeInTheDocument();
    // getByRole throws on multiple matches, so this also proves the title appears once.
    expect(screen.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
  });

  it("returns to the screen help was opened from on Escape", async () => {
    const user = userEvent.setup();
    const router = createHelpRouter(["/history"]);
    render(<RouterProvider router={router} />, { wrapper: Providers });
    await screen.findByText("history screen");

    await act(async () => {
      await router.navigate({ to: "/help" });
    });
    await screen.findByRole("heading", { level: 1, name: "Help" });

    await user.keyboard("{Escape}");

    await waitFor(() => expect(router.state.location.pathname).toBe("/history"));
    expect(screen.getByText("history screen")).toBeVisible();
  });

  it("falls back to home on Escape when help has no history to return to", async () => {
    const user = userEvent.setup();
    const { router } = await renderPage();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(screen.getByText("home screen")).toBeVisible();
  });

  it("lists the keyboard shortcuts grouped for the web surface", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { name: /keyboard shortcuts/i })).toBeVisible();
    expect(screen.getByRole("list", { name: "Anywhere" })).toBeVisible();
    expect(screen.getAllByText("Move the highlight")).toHaveLength(1);
  });

  // Brackets mark the pane focus actually sits in, and focus lives on the
  // scroll region wrapping the sheet rather than inside it, so the sheet wears
  // the resting chrome: a continuous border and no corners.
  it("rests on the hairline frame and draws no corner brackets", async () => {
    const { container } = await renderPage();

    const sheet = screen.getByRole("region", { name: /^help$/i });
    expect(sheet).toHaveAttribute("data-frame", "hairline");
    expect(sheet).not.toHaveAttribute("data-state");
    expect(container.querySelectorAll('[data-slot="panel-corners"]')).toHaveLength(0);
  });

  it("groups the shortcuts by context in the canonical order", async () => {
    await renderPage();

    const groupHeadings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(groupHeadings).toEqual([
      "Anywhere",
      "In lists",
      "On the home screen",
      "On the Providers page",
      "In a review",
      "In history",
    ]);

    for (const name of [
      "Anywhere",
      "In lists",
      "On the home screen",
      "On the Providers page",
      "In a review",
      "In history",
    ]) {
      expect(screen.getByRole("list", { name })).toBeInTheDocument();
    }
  });

  it("keeps the two ↑/↓ rows apart by context instead of by label", async () => {
    await renderPage();

    const lists = ["In lists", "In a review"].map((name) =>
      screen.getByRole("list", { name }),
    ) as HTMLElement[];
    expect(within(lists[0] as HTMLElement).getByText("↑/↓")).toBeVisible();
    expect(within(lists[0] as HTMLElement).getByText("Move the highlight")).toBeVisible();
    expect(within(lists[1] as HTMLElement).getByText("↑/↓")).toBeVisible();
    expect(within(lists[1] as HTMLElement).getByText("Scroll the focused pane")).toBeVisible();
  });

  it("advertises history search in its own context group", async () => {
    await renderPage();

    const history = screen.getByRole("list", { name: "In history" });
    expect(within(history).getByText("Search Runs")).toBeVisible();
    expect(within(history).getByText("/")).toBeVisible();
  });

  it("advertises the live web-only h and ? bindings and omits the nonexistent r/R rows", async () => {
    await renderPage();

    expect(screen.getByText("Open History")).toBeVisible();
    expect(screen.getByText("Open Help")).toBeVisible();
    expect(screen.queryByText("Review Unstaged Changes")).not.toBeInTheDocument();
    expect(screen.queryByText("Review Staged Changes")).not.toBeInTheDocument();
  });

  it("gives each review scroll key its own truthful row", async () => {
    await renderPage();

    const shortcuts = screen.getByRole("list", { name: "In a review" });
    const rows: [string, string][] = [
      ["↑/↓", "Scroll the focused pane"],
      ["PgUp/PgDn", "Page up or down"],
      ["Home/End", "Jump to start or end"],
    ];
    for (const [key, label] of rows) {
      expect(within(shortcuts).getAllByText(key).length).toBeGreaterThan(0);
      expect(within(shortcuts).getByText(label)).toBeVisible();
    }
  });

  it("still collapses the keys that do share one action into a single row", async () => {
    await renderPage();

    const lists = screen.getByRole("list", { name: "In lists" });
    expect(within(lists).getAllByText("Move the highlight")).toHaveLength(1);
    for (const key of ["↑/↓", "j/k"]) {
      expect(within(lists).getAllByText(key).length).toBeGreaterThan(0);
    }
  });

  it("opens with focus on the labelled scroll region instead of document.body", async () => {
    await renderPage();

    expect(screen.getByRole("region", { name: "Help content" })).toHaveFocus();
  });

  it("scrolls the focused help region with arrow and page keys when the shortcut table overflows", async () => {
    const user = userEvent.setup();
    await renderPage();
    const region = screen.getByRole("region", { name: "Help content" });
    // jsdom has no layout; pin the metrics that make the region overflow.
    Object.defineProperty(region, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(region, "scrollHeight", { value: 1000, configurable: true });

    expect(region).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(region.scrollTop).toBe(40);

    await user.keyboard("{PageDown}");
    expect(region.scrollTop).toBe(120);

    await user.keyboard("{ArrowUp}");
    expect(region.scrollTop).toBe(80);
  });

  // jsdom applies no CSS, so the `pointer-coarse` gate that decides whether this
  // section reaches the accessibility tree is a browser contract, asserted in
  // testing/e2e/responsive-contracts.e2e.ts. This covers only the markup.
  it("renders the touch gesture rows and their labels", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { name: /touch gestures/i })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /touch gestures/i })).toBeInTheDocument();
    expect(screen.getByText("Tap")).toBeInTheDocument();
    expect(screen.getByText("Swipe")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });
});
