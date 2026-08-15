import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import DialogCustomTrigger from "./dialog-custom-trigger";

describe("DialogCustomTrigger", () => {
  it('ships with a leading "use client" directive for copyable App Router usage', () => {
    const source = readFileSync(resolve(import.meta.dirname, "dialog-custom-trigger.tsx"), "utf8");
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).toMatch(/\{\(triggerProps\) =>/);
  });

  it("opens the dialog from the custom Button trigger", async () => {
    const user = userEvent.setup();
    render(<DialogCustomTrigger />);

    await user.click(screen.getByRole("button", { name: "Open Dialog" }));

    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");
    expect(screen.getByText(/render-prop pattern/i)).toBeInTheDocument();
  });
});
