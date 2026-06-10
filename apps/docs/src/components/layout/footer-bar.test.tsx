// @vitest-environment jsdom

import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FooterBar } from "./footer-bar";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    useNavigate: () => navigateMock,
  };
});

describe("FooterBar", () => {
  it("links theme, privacy, and terms to their routes", () => {
    render(
      <KeyboardProvider>
        <FooterBar />
      </KeyboardProvider>,
    );

    expect(screen.getByRole("link", { name: /theme/i })).toHaveAttribute("href", "/ui/theme");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });

  it("navigates to the theme page when F2 is pressed", async () => {
    const user = userEvent.setup();
    render(
      <KeyboardProvider>
        <FooterBar />
      </KeyboardProvider>,
    );

    await user.keyboard("{F2}");

    expect(navigateMock).toHaveBeenCalledWith({
      to: "/$lib/$",
      params: { lib: "ui", _splat: "theme" },
    });
  });

  it("shows only the theme shortcut hint", () => {
    render(
      <KeyboardProvider>
        <FooterBar />
      </KeyboardProvider>,
    );

    expect(screen.getByText("F2")).toBeInTheDocument();
    expect(screen.queryByText("F1")).not.toBeInTheDocument();
    expect(screen.queryByText("Esc")).not.toBeInTheDocument();
  });
});
