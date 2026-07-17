import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
