// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HookSource, LibraryHookSource } from "./hook-source";

describe("HookSource", () => {
  it("renders a hook block through the shared Accordion disclosure", async () => {
    const user = userEvent.setup();
    render(<HookSource library="keys" hook="use-navigation" />);

    const trigger = screen.getByRole("button", { name: /useNavigation source \(6 files\)/i });
    expect(trigger).toBeInTheDocument();
    expect(
      screen.getByText("Standalone keyboard navigation for role-based lists and tabs"),
    ).toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByText("src/hooks/use-navigation.ts")).toBeInTheDocument();
    expect(screen.getByText("src/hooks/utils/navigation-dispatch.ts")).toBeInTheDocument();
  });

  it("renders nothing for an unknown hook", () => {
    const { container } = render(<HookSource library="keys" hook="missing" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("LibraryHookSource", () => {
  it("lists every library hook through the shared disclosure", () => {
    render(<LibraryHookSource library="keys" sectionTitle="Standalone Hooks" hint="copy these" />);

    expect(screen.getByRole("heading", { name: "Standalone Hooks" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /useNavigation source \(6 files\)/i }),
    ).toBeInTheDocument();
  });
});
