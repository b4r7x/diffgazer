import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import EmptyStateLive from "./empty-state-live";

describe("empty-state-live example", () => {
  it("keeps the live region mounted across the results→empty transition", async () => {
    const user = userEvent.setup();
    render(<EmptyStateLive />);

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent("");

    await user.type(screen.getByRole("searchbox", { name: /filter hooks/i }), "zzz");

    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent(/no hooks match/i);
  });
});
