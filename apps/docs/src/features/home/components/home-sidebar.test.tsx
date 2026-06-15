// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/testing/match-media";
import type { HomeLibrary } from "../data";
import { HomeSidebar } from "./home-sidebar";

// Boundary mock: TanStack Router is the external routing library; sidebar links need deterministic hrefs/current path.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
      select({ pathname: "/" }),
  };
});

const LIBRARIES: HomeLibrary[] = [
  {
    id: "ui",
    displayName: "@diffgazer/ui",
    sections: [{ name: "Components", splat: "components/button", count: 47 }],
  },
];

beforeEach(() => {
  stubMatchMedia({ isDesktop: true });
  Element.prototype.scrollIntoView = () => {};
});

describe("HomeSidebar", () => {
  it("calls onNavigate when a sidebar link is clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<HomeSidebar libraries={LIBRARIES} onNavigate={onNavigate} />);

    await user.click(screen.getByRole("link", { name: /Components \(47\)/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not call onNavigate for a modifier click", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<HomeSidebar libraries={LIBRARIES} onNavigate={onNavigate} />);

    await user.keyboard("{Meta>}");
    await user.click(screen.getByRole("link", { name: /Components \(47\)/i }));
    await user.keyboard("{/Meta}");

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
