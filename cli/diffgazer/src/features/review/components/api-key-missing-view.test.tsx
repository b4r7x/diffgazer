import { FooterProvider } from "@diffgazer/core/footer";
import { CONFIGURATION_ERROR_COPY, CREDENTIAL_ERROR_COPY } from "@diffgazer/core/review";
import { READINESS_PRESENTATION, ReadinessSchema } from "@diffgazer/core/schemas/config";
import { makeReadiness } from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { frameText } from "../testing/frame-text";
import {
  ApiKeyMissingView,
  ConfigurationErrorView,
  ReviewTerminalReceiptView,
} from "./api-key-missing-view";

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

  test("renders a rejected credential as the warning-toned reconnect state with metadata", async () => {
    const onGoToSettings = vi.fn();
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <ApiKeyMissingView
            productLabel="Google Gemini"
            meta="Google Gemini / gemini-2.5-flash"
            readiness={makeReadiness("credential-invalid")}
            onGoToSettings={onGoToSettings}
            onBack={vi.fn()}
          />
        </FooterProvider>
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    // Warning glyph, never the error cross: this is a setup state.
    expect(frame).toContain("⚠ Reconnect Provider");
    expect(frame).not.toContain("✖");
    expect(frame).not.toContain("Configuration Not Ready");
    // The configuration's identity survives the broken credential.
    expect(frame).toContain("Google Gemini / gemini-2.5-flash");
    expect(frame).toContain("[ Enter API Key ]");

    stdin.write("\r");
    await waitUntil(() => onGoToSettings.mock.calls.length === 1);
  });
});

function renderConfigurationError() {
  const onRetry = vi.fn();
  const onGoToSettings = vi.fn();
  const onBack = vi.fn();
  const view = render(
    <CliThemeProvider initialTheme="dark">
      <FooterProvider initialShortcuts={[]}>
        <ConfigurationErrorView onRetry={onRetry} onGoToSettings={onGoToSettings} onBack={onBack} />
      </FooterProvider>
    </CliThemeProvider>,
  );
  return { ...view, onRetry, onGoToSettings, onBack };
}

describe("ConfigurationErrorView (TUI)", () => {
  test("keeps retry-first copy and leads with Retry, unlike the not-ready gate", () => {
    const { lastFrame } = renderConfigurationError();
    const frame = lastFrame() ?? "";

    expect(frame).toContain(CONFIGURATION_ERROR_COPY.title);
    expect(frameText(frame)).toContain(CONFIGURATION_ERROR_COPY.body);
    expect(frame).not.toContain("Configuration Not Ready");
    expect(frame).toContain("[ Retry ]");
    expect(frame).toContain("Configure Provider");
  });

  test("Enter retries and Escape still goes back", async () => {
    const { stdin, onRetry, onGoToSettings, onBack } = renderConfigurationError();

    stdin.write("\r");
    await waitUntil(() => onRetry.mock.calls.length === 1);

    stdin.write(ESCAPE);
    await waitUntil(() => onBack.mock.calls.length === 1);
    expect(onGoToSettings).not.toHaveBeenCalled();
  });

  test("p recovers to provider settings when retry cannot help", async () => {
    const { stdin, onRetry, onGoToSettings } = renderConfigurationError();

    stdin.write("p");
    await waitUntil(() => onGoToSettings.mock.calls.length === 1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  test("reads a credential-caused init failure as the warning reconnect gate, bindings intact", async () => {
    const onRetry = vi.fn();
    const onGoToSettings = vi.fn();
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <ConfigurationErrorView
            error={Object.assign(new Error("keyring read failed"), {
              status: 500,
              code: "KEYRING_READ_FAILED",
            })}
            onRetry={onRetry}
            onGoToSettings={onGoToSettings}
            onBack={vi.fn()}
          />
        </FooterProvider>
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain(`⚠ ${CREDENTIAL_ERROR_COPY.title}`);
    expect(frame).not.toContain("✖");
    expect(frame).not.toContain(CONFIGURATION_ERROR_COPY.title);
    expect(frame).toContain("[ Retry ]");
    expect(frame).toContain("Configure Provider");

    stdin.write("\r");
    await waitUntil(() => onRetry.mock.calls.length === 1);
    stdin.write("p");
    await waitUntil(() => onGoToSettings.mock.calls.length === 1);
  });
});

describe("ReviewTerminalReceiptView (TUI)", () => {
  test("offers a single Back action that Enter and Escape both fire", async () => {
    const onBack = vi.fn();
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <ReviewTerminalReceiptView outcome="cancelled" onBack={onBack} />
        </FooterProvider>
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Review Cancelled");
    expect(frameText(frame)).toContain("The review was cancelled before it completed.");
    expect(frame.split("[ Back ]")).toHaveLength(2);

    stdin.write("\r");
    await waitUntil(() => onBack.mock.calls.length === 1);

    stdin.write(ESCAPE);
    await waitUntil(() => onBack.mock.calls.length === 2);
  });
});
