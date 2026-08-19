import type { ProviderConsentGate } from "@diffgazer/core/api/hooks";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { PROVIDER_CONSENT_TEXT } from "@diffgazer/core/schemas/config";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import type { ReactElement } from "react";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../app/providers/keyboard";
import { flush } from "../../testing/flush";
import { CliThemeProvider } from "../../theme/provider";
import { ProviderConsentOverlay } from "./provider-consent-overlay";

// The 80x24 floor: 80 columns, 24 rows minus the app header and footer.
const contentZone = { columns: 100, contentColumns: 100, contentRows: 26 };

vi.mock("../layout/global", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../layout/global")>();
  return {
    ...actual,
    useContentZone: () => contentZone,
  };
});

const ENTER = "\r";
const ESCAPE = "\u001b";
const RIGHT = "\u001b[C";

function FooterProbe(): ReactElement {
  const { shortcuts, rightShortcuts } = useFooterData();
  const format = (list: typeof shortcuts) =>
    list.map((shortcut) => `[${shortcut.key}] ${shortcut.label}`).join(" ");
  return <Text>{`FOOTER ${format(shortcuts)} | ${format(rightShortcuts)}`}</Text>;
}

function renderOverlay(overrides: Partial<ProviderConsentGate> = {}) {
  const gate: ProviderConsentGate = {
    consent: null,
    isOpen: true,
    readBack: null,
    continues: true,
    isAccepting: false,
    error: null,
    require: vi.fn(),
    open: vi.fn(),
    accept: vi.fn(),
    decline: vi.fn(),
    ...overrides,
  };
  const view = render(
    <CliThemeProvider initialTheme="dark">
      <TerminalKeyboardProvider>
        <FooterProvider initialShortcuts={[]}>
          <FooterProbe />
          <ProviderConsentOverlay gate={gate} />
        </FooterProvider>
      </TerminalKeyboardProvider>
    </CliThemeProvider>,
  );
  return { ...view, gate, frame: () => stripAnsi(view.lastFrame() ?? "") };
}

afterEach(() => {
  cleanup();
  Object.assign(contentZone, { columns: 100, contentColumns: 100, contentRows: 26 });
});

describe("ProviderConsentOverlay", () => {
  test("shows the notice with Accept and continue focused, and Enter accepts without closing", async () => {
    const { stdin, frame, gate } = renderOverlay();
    await flush();

    expect(frame()).toContain("Provider data notice");
    expect(frame()).toContain(PROVIDER_CONSENT_TEXT.slice(0, 32));
    expect(frame()).toContain("https://docs.b4r7.dev/app/concepts/privacy");
    expect(frame()).toContain("[ Accept and continue ]");
    expect(frame()).toContain("FOOTER [←/→] Switch Action [Enter] Accept | [Esc] Not now");

    stdin.write(ENTER);
    await flush();
    expect(gate.accept).toHaveBeenCalledOnce();
    expect(gate.decline).not.toHaveBeenCalled();
  });

  test("Escape and the Not now action both decline", async () => {
    const { stdin, gate } = renderOverlay();
    await flush();

    stdin.write(RIGHT);
    await flush();
    stdin.write(ENTER);
    await flush();
    expect(gate.decline).toHaveBeenCalledOnce();
    expect(gate.accept).not.toHaveBeenCalled();

    stdin.write(ESCAPE);
    await vi.waitFor(() => expect(gate.decline).toHaveBeenCalledTimes(2));
  });

  test("names the plain acceptance when nothing waits behind the notice, and shows a failed save", async () => {
    const { frame } = renderOverlay({ continues: false, error: "settings file is read-only" });
    await flush();

    expect(frame()).toContain("[ Accept ]");
    expect(frame()).not.toContain("[ Accept and continue ]");
    expect(frame()).toContain("settings file is read-only");
  });

  test("holds the notice while the acceptance is being saved", async () => {
    const { stdin, frame, gate } = renderOverlay({ isAccepting: true });
    await flush();

    expect(frame()).toContain("Saving...");
    stdin.write(ESCAPE);
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(gate.decline).not.toHaveBeenCalled();
  });

  test("reads an accepted notice back with its date and a single Close", async () => {
    const accepted = { version: 1 as const, acceptedAt: "2026-08-18T10:00:00.000Z" };
    const { stdin, frame, gate } = renderOverlay({
      consent: accepted,
      readBack: accepted,
      continues: false,
    });
    await flush();

    expect(frame()).toMatch(/Accepted 2026-08-1[89]/);
    expect(frame()).toContain("[ Close ]");
    expect(frame()).not.toContain("Accept ]");
    expect(frame()).toContain("FOOTER  | [Esc] Close");

    stdin.write(ENTER);
    await flush();
    expect(gate.decline).toHaveBeenCalledOnce();
    expect(gate.accept).not.toHaveBeenCalled();
  });

  test("keeps the title, its description and one action row inside the 80x24 floor", async () => {
    Object.assign(contentZone, { columns: 80, contentColumns: 80, contentRows: 20 });
    const { frame } = renderOverlay({ error: "settings file is read-only" });
    await flush();

    const lines = frame().split("\n");
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(80);
    // The card's corners survive the content zone's clip, so nothing is cut off.
    expect(frame()).toContain("┌");
    expect(frame()).toContain("└");
    // Title alone on its line, the description directly under it.
    const titleIndex = lines.findIndex((line) => line.includes("Provider data notice"));
    expect(lines[titleIndex]?.trim().replace(/[│ ]/g, "")).toBe("Providerdatanotice");
    expect(lines[titleIndex + 1]).toContain("Asked once, before anything is sent to a provider");
    // Both actions share the single footer line.
    const actionLine = lines.find((line) => line.includes("[ Accept and continue ]"));
    expect(actionLine).toContain("[ Not now ]");
  });

  // The acceptance lands in settings before the notice closes; the notice it
  // was accepted through stays up until then, not the read-back.
  test("keeps offering the acceptance it opened with once the consent is on record", async () => {
    const { frame } = renderOverlay({
      consent: { version: 1, acceptedAt: "2026-08-18T10:00:00.000Z" },
      readBack: null,
    });
    await flush();

    expect(frame()).toContain("[ Accept and continue ]");
    expect(frame()).not.toContain("[ Close ]");
    expect(frame()).toContain("Asked once");
  });
});
