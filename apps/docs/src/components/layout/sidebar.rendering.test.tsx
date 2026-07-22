// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageTree, PageTreeNode } from "@/lib/page-tree";
import { stubMatchMedia } from "@/testing/match-media";
import { DocsSidebar } from "./sidebar";

const routerBoundary = vi.hoisted(() => ({
  pathname: "/ui/unlisted",
}));

// Boundary mock: @tanstack/react-router is the external route context boundary.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock, useLocationMock, useRouterStateMock } = await import(
    "@/testing/router-mock"
  );
  return {
    Link: RouterLinkMock,
    ...useLocationMock({
      get pathname() {
        return routerBoundary.pathname;
      },
    }),
    ...useRouterStateMock({
      get pathname() {
        return routerBoundary.pathname;
      },
    }),
  };
});

function pageTree(children: PageTreeNode[]): PageTree {
  return { name: "ui", children };
}

function renderDocsSidebar(tree: PageTree, pathname = "/ui/unlisted") {
  routerBoundary.pathname = pathname;
  window.history.replaceState(null, "", pathname);
  render(<DocsSidebar tree={tree} library="ui" />);
}

beforeEach(() => {
  stubMatchMedia({ isDesktop: true });
  Element.prototype.scrollIntoView = () => {};
  routerBoundary.pathname = "/ui/unlisted";
  window.history.replaceState(null, "", routerBoundary.pathname);
});

describe("DocsSidebar rendering", () => {
  describe("section grouping", () => {
    it("titles the first section from its leading separator", () => {
      renderDocsSidebar(
        pageTree([
          { type: "separator", name: "Getting Started" },
          { type: "page", name: "Overview", url: "/ui/getting-started" },
          { type: "separator", name: "Components" },
          { type: "page", name: "Button", url: "/ui/components/button" },
        ]),
      );

      expect(screen.getByRole("heading", { name: "Getting Started" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Components" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
        "href",
        "/ui/getting-started",
      );
      expect(screen.getByRole("link", { name: "Button" })).toHaveAttribute(
        "href",
        "/ui/components/button",
      );
    });

    it("drops separators that label no items so no stray header renders", () => {
      renderDocsSidebar(
        pageTree([
          { type: "separator", name: "Empty" },
          { type: "separator", name: "Components" },
          { type: "page", name: "Button", url: "/ui/components/button" },
          { type: "separator", name: "Trailing" },
        ]),
      );

      expect(screen.queryByRole("heading", { name: "Empty" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Trailing" })).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Components" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Button" })).toBeInTheDocument();
    });
  });

  describe("item labels", () => {
    it("relabels the section index item whose name echoes the section header", () => {
      renderDocsSidebar(
        pageTree([
          { type: "separator", name: "Hooks" },
          { type: "page", name: "Hooks", url: "/ui/hooks" },
          { type: "page", name: "Active Heading", url: "/ui/hooks/active-heading" },
        ]),
      );

      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/ui/hooks");
      expect(screen.getByRole("link", { name: "Active Heading" })).toHaveAttribute(
        "href",
        "/ui/hooks/active-heading",
      );
    });

    it("matches the section header case-insensitively", () => {
      renderDocsSidebar(
        pageTree([
          { type: "separator", name: "Web Mode" },
          { type: "page", name: "Web mode", url: "/ui/web" },
          { type: "page", name: "Onboarding", url: "/ui/web/onboarding" },
        ]),
      );

      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/ui/web");
      expect(screen.getByRole("link", { name: "Onboarding" })).toBeInTheDocument();
    });

    it("relabels when the index name extends the section header with a suffix", () => {
      renderDocsSidebar(
        pageTree([
          { type: "separator", name: "Terminal UI" },
          { type: "page", name: "Terminal UI (beta)", url: "/ui/tui" },
          { type: "page", name: "Keybindings", url: "/ui/tui/keybindings" },
        ]),
      );

      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/ui/tui");
      expect(screen.getByRole("link", { name: "Keybindings" })).toBeInTheDocument();
    });

    it("keeps a distinct index title that does not echo the section header", () => {
      renderDocsSidebar(
        pageTree([
          { type: "separator", name: "Getting Started" },
          { type: "page", name: "Introduction", url: "/ui/getting-started" },
          { type: "page", name: "Installation", url: "/ui/getting-started/installation" },
        ]),
      );

      expect(screen.getByRole("link", { name: "Introduction" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Installation" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
    });

    it("collapses an index title that redundantly prefixes the section header", () => {
      renderDocsSidebar(
        pageTree([
          { type: "separator", name: "API" },
          { type: "page", name: "API Overview", url: "/ui/api" },
          { type: "page", name: "Types", url: "/ui/api/types" },
        ]),
      );

      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/ui/api");
      expect(screen.getByRole("link", { name: "Types" })).toBeInTheDocument();
    });

    it("never relabels a subpage even when its name equals the section header", () => {
      renderDocsSidebar(
        pageTree([
          { type: "separator", name: "Reference" },
          { type: "page", name: "Reference", url: "/ui/reference" },
          { type: "page", name: "CLI reference", url: "/ui/reference/cli" },
          { type: "page", name: "Configuration", url: "/ui/reference/configuration" },
        ]),
      );

      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
        "href",
        "/ui/reference",
      );
      expect(screen.getByRole("link", { name: "CLI reference" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Configuration" })).toBeInTheDocument();
    });

    it("leaves items untouched when the section has no index page", () => {
      renderDocsSidebar(
        pageTree([
          { type: "separator", name: "Components" },
          { type: "page", name: "Button", url: "/ui/components/button" },
          { type: "page", name: "Card", url: "/ui/components/card" },
        ]),
      );

      expect(screen.getByRole("link", { name: "Button" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Card" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
    });
  });
});
