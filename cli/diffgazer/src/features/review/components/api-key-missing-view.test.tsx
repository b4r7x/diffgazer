import { FooterProvider } from "@diffgazer/core/footer";
import { READINESS_PRESENTATION, ReadinessSchema } from "@diffgazer/core/schemas/config";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { ApiKeyMissingView } from "./api-key-missing-view";

const ARROW_RIGHT = "\u001b[C";
const ESCAPE = "\u001b";

function unconfiguredReadiness() {
  return ReadinessSchema.parse({
    status: "unconfigured",
    ready: false,
    evidenceStatus: "not-checked",
    checkedAt: null,
    acknowledgement: { status: "not-applicable" },
    ...READINESS_PRESENTATION.unconfigured,
  });
}

afterEach(() => {
  cleanup();
});

describe("ApiKeyMissingView (TUI)", () => {
  test("lets keyboard users go back with Escape or the reachable Back button", async () => {
    const onGoToSettings = vi.fn();
    const onBack = vi.fn();
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <ApiKeyMissingView
            productLabel="Google Gemini"
            readiness={unconfiguredReadiness()}
            onGoToSettings={onGoToSettings}
            onBack={onBack}
          />
        </FooterProvider>
      </CliThemeProvider>,
    );

    expect(lastFrame()).toContain("Configuration Not Ready");
    expect(lastFrame()).toContain("Configure Provider");
    expect(lastFrame()).not.toMatch(/api key/i);

    stdin.write(ESCAPE);
    await waitUntil(() => onBack.mock.calls.length === 1);

    expect(onBack).toHaveBeenCalledTimes(1);

    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write("\r");
    await waitUntil(() => onBack.mock.calls.length === 2);
    expect(onGoToSettings).not.toHaveBeenCalled();
  });

  test("activates Configure Provider with Enter without needing to navigate to it first", async () => {
    const onGoToSettings = vi.fn();
    const onBack = vi.fn();
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <ApiKeyMissingView
            readiness={unconfiguredReadiness()}
            onGoToSettings={onGoToSettings}
            onBack={onBack}
          />
        </FooterProvider>
      </CliThemeProvider>,
    );

    expect(lastFrame()).toContain("Configure Provider");
    stdin.write("\r");
    expect(onGoToSettings).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });
});
