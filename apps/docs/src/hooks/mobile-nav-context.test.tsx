import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { stubControllableMatchMedia } from "@/testing/match-media";
import { MobileNavProvider, useMobileNav } from "./mobile-nav-context";

function Probe() {
  const { open, setOpen, isDesktop } = useMobileNav();

  return (
    <div>
      <output aria-label="Drawer state">{open ? "open" : "closed"}</output>
      <output aria-label="Viewport state">{isDesktop ? "desktop" : "mobile"}</output>
      <button type="button" onClick={() => setOpen(true)}>
        Open sidebar
      </button>
    </div>
  );
}

describe("MobileNavProvider", () => {
  it("closes the mobile sidebar when the viewport returns to desktop", async () => {
    const viewport = stubControllableMatchMedia({ isDesktop: false });

    const user = userEvent.setup();
    render(
      <MobileNavProvider>
        <Probe />
      </MobileNavProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open sidebar" }));
    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("open");

    act(() => {
      viewport.setDesktop(true);
    });

    expect(screen.getByRole("status", { name: "Drawer state" })).toHaveTextContent("closed");
    expect(screen.getByRole("status", { name: "Viewport state" })).toHaveTextContent("desktop");
  });
});
