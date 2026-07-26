import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Dialog } from "./index";

describe("Dialog narrow-viewport geometry", () => {
  // Public styling contract exception: jsdom cannot compute media queries or
  // env() insets, so the class contract is the only observable form these
  // geometry decisions take in a unit test.
  it("insets the panel from the viewport edge below 640px", () => {
    render(
      <Dialog open>
        <Dialog.Content>
          <Dialog.Title>Settings</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const content = screen.getByRole("dialog", { name: "Settings" });

    expect(content.className).toContain("max-sm:mx-3");
    expect(content.className).toContain("max-sm:w-[calc(100%-1.5rem)]");
    expect(content.className).toContain("max-sm:max-w-none");
  });

  it("clears the home indicator and keeps the OV-03 dynamic-viewport cap", () => {
    render(
      <Dialog open>
        <Dialog.Content>
          <Dialog.Title>Settings</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const content = screen.getByRole("dialog", { name: "Settings" });

    expect(content.className).toContain("max-sm:pb-[env(safe-area-inset-bottom)]");
    expect(content.className).toContain("max-h-[90dvh]");
  });

  it("has no a11y violations with the narrow-viewport classes applied", async () => {
    const { container } = render(
      <Dialog open>
        <Dialog.Content>
          <Dialog.Title>Settings</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
