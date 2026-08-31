import type { EndpointProfile } from "@diffgazer/core/providers";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { CliThemeProvider } from "../../../theme/provider";
import { PoolFilterTabs } from "./pool-filter-tabs";

const ARROW_LEFT = "\u001b[D";
const ARROW_RIGHT = "\u001b[C";

const PROFILES: EndpointProfile[] = [
  { id: "zen", label: "OpenCode Zen", shortLabel: "Zen", endpoint: "https://opencode.ai/zen/v1" },
  { id: "go", label: "OpenCode Go", shortLabel: "Go", endpoint: "https://opencode.ai/zen/go/v1" },
];

function renderTabs(onChange = vi.fn(), isActive = true, value = "zen") {
  const view = render(
    <CliThemeProvider initialTheme="dark">
      <PoolFilterTabs profiles={PROFILES} value={value} onChange={onChange} isActive={isActive} />
    </CliThemeProvider>,
  );
  return { ...view, onChange };
}

afterEach(() => {
  cleanup();
});

describe("PoolFilterTabs", () => {
  test("marks the armed pool with a glyph, so the state survives a stripped frame", () => {
    const frame = stripAnsi(renderTabs().lastFrame() ?? "");

    expect(frame).toContain("· Zen");
    expect(frame).toContain("Go");
    expect(frame).not.toContain("· Go");
  });

  // The tier row this mirrors cycles, so the pool row does too: with two pools
  // either arrow reaches the other one.
  test("arrows cycle to the other pool", async () => {
    const { stdin, onChange } = renderTabs();

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(onChange).toHaveBeenCalledWith("go");

    onChange.mockClear();
    stdin.write(ARROW_LEFT);
    await flush();
    expect(onChange).toHaveBeenCalledWith("go");
  });

  test("ignores arrows while another zone holds focus", async () => {
    const { stdin, onChange } = renderTabs(vi.fn(), false);

    stdin.write(ARROW_RIGHT);
    await flush();

    expect(onChange).not.toHaveBeenCalled();
  });
});
