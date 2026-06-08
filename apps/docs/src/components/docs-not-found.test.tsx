// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PageTree } from "@/lib/page-tree";
import { DocsNotFoundBlock } from "./docs-not-found";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string;
    params?: { lib?: string; _splat?: string };
    children: React.ReactNode;
    className?: string;
  }) => {
    let href = to;
    if (params?.lib) href = href.replace("$lib", params.lib);
    href = params?._splat ? href.replace("$", params._splat) : href.replace("/$", "");
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

vi.mock("@/components/layout/content-layout", () => ({
  DocsContentLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const TREE: PageTree = {
  name: "ui",
  children: [{ type: "page", name: "Button", url: "/ui/components/button" }],
};

describe("DocsNotFoundBlock", () => {
  it("does not nest buttons inside links for recovery actions", () => {
    const { container } = render(<DocsNotFoundBlock tree={TREE} library="ui" />);

    expect(screen.getByRole("link", { name: "Go to docs home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toBeInTheDocument();

    for (const link of container.querySelectorAll("a")) {
      expect(link.querySelector("button")).toBeNull();
    }
  });
});
