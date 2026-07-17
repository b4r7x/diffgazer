import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ToggleGroupCounts from "./toggle-group-counts";

function expectActive(buttons: HTMLElement[], active: HTMLElement) {
  for (const button of buttons) {
    expect(button).toHaveAttribute("aria-pressed", button === active ? "true" : "false");
  }
}

describe("ToggleGroupCounts", () => {
  it("keeps the small and medium option domains independently selectable", async () => {
    const user = userEvent.setup();
    render(<ToggleGroupCounts />);

    const small = within(screen.getByRole("group", { name: "Severity filter (small)" }));
    const medium = within(screen.getByRole("group", { name: "Severity filter (medium)" }));
    const smallButtons = small.getAllByRole("button");
    const mediumButtons = medium.getAllByRole("button");
    const smallError = small.getByRole("button", { name: /^Error 3$/ });
    const smallWarning = small.getByRole("button", { name: /^Warning 12$/ });
    const smallInfo = small.getByRole("button", { name: /^Info 27$/ });
    const mediumError = medium.getByRole("button", { name: /^Error 3$/ });
    const mediumWarning = medium.getByRole("button", { name: /^Warning 12$/ });

    for (const option of [smallWarning, smallError, smallInfo]) {
      await user.click(option);
      expectActive(smallButtons, option);
      expectActive(mediumButtons, mediumError);
    }

    for (const option of [mediumWarning, mediumError]) {
      await user.click(option);
      expectActive(mediumButtons, option);
      expectActive(smallButtons, smallInfo);
    }
  });
});
