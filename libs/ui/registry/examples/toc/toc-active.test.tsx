import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TocActive from "./toc-active";

describe("TocActive", () => {
  it.each([
    { id: "overview", title: "Overview", level: 2 },
    { id: "installation", title: "Installation", level: 2 },
    { id: "npm", title: "npm", level: 3 },
    { id: "pnpm", title: "pnpm", level: 3 },
    { id: "usage", title: "Usage", level: 2 },
  ])("renders $title depth as an h$level target", ({ id, title, level }) => {
    render(<TocActive />);

    expect(screen.getByRole("heading", { name: title, level })).toHaveAttribute("id", id);
    expect(screen.getByRole("link", { name: title })).toHaveAttribute("href", `#${id}`);
  });

  it("moves aria-current to the link the user clicks", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<TocActive />);

    const links = screen.getAllByRole("link");
    const initiallyActive = links.find((link) => link.getAttribute("aria-current") === "location");
    if (!initiallyActive) throw new Error("expected an initially active link");
    const target = links.find((link) => link !== initiallyActive);
    if (!target) throw new Error("expected a non-current link to click");

    await user.click(target);

    expect(target).toHaveAttribute("aria-current", "location");
    expect(initiallyActive).not.toHaveAttribute("aria-current");

    scrollTo.mockRestore();
  });
});
