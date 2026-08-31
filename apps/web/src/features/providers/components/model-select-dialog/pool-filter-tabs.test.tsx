import { getEndpointPoolContext } from "@diffgazer/core/providers";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModelPoolFilterTabs } from "./pool-filter-tabs";

const poolContext = getEndpointPoolContext("opencode-zen", "https://opencode.ai/zen/v1");
if (!poolContext) throw new Error("opencode-zen must expose a billing-pool context");
const PROFILES = [poolContext.bound, poolContext.sibling];

function renderTabs(overrides: Partial<Parameters<typeof ModelPoolFilterTabs>[0]> = {}) {
  const onChange = overrides.onChange ?? vi.fn();
  render(
    <ModelPoolFilterTabs
      profiles={PROFILES}
      value={PROFILES[0]?.id ?? ""}
      onChange={onChange}
      focusedIndex={0}
      isFocused={false}
      {...overrides}
    />,
  );
  return { onChange, group: screen.getByRole("radiogroup", { name: "Billing pool" }) };
}

describe("ModelPoolFilterTabs", () => {
  it("names each pool in full while showing the badge-length label", () => {
    const { group } = renderTabs();

    const zen = within(group).getByRole("radio", { name: "OpenCode Zen" });
    expect(zen).toBeChecked();
    const go = within(group).getByRole("radio", { name: "OpenCode Go" });
    expect(go).not.toBeChecked();
    // Exact, not substring: the full label contains the badge one, so anything
    // looser passes on a tab that never shortened its text.
    expect(zen.textContent).toBe("Zen");
    expect(go.textContent).toBe("Go");
  });

  it("reports the pool the user picked", async () => {
    const user = userEvent.setup();
    const { onChange, group } = renderTabs();

    await user.click(within(group).getByRole("radio", { name: "OpenCode Go" }));

    expect(onChange).toHaveBeenCalledWith("go");
  });

  it("stays inert while disabled", async () => {
    const user = userEvent.setup();
    const { onChange, group } = renderTabs({ disabled: true });

    await user.click(within(group).getByRole("radio", { name: "OpenCode Go" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
