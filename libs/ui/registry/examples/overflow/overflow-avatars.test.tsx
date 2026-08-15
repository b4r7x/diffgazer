import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OverflowAvatarsExample from "./overflow-avatars";

describe("OverflowAvatarsExample", () => {
  it('ships with a leading "use client" directive for copyable App Router usage', () => {
    const source = readFileSync(resolve(import.meta.dirname, "overflow-avatars.tsx"), "utf8");
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).toMatch(/indicator=\{\(\{ count \}\) =>/);
  });

  it("names avatars with full person names instead of fallback initials", () => {
    render(<OverflowAvatarsExample />);

    expect(screen.getAllByRole("img", { name: "Felix" })).toHaveLength(2);
    expect(screen.getAllByRole("img", { name: "Aria" })).toHaveLength(2);
    expect(screen.queryByRole("img", { name: "FX" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "AR" })).not.toBeInTheDocument();
  });
});
