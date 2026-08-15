import { FooterProvider } from "@diffgazer/core/footer";
import { AGENT_METADATA, type AgentState } from "@diffgazer/core/schemas/events";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";

import { cleanupRootFrames } from "../../../../testing/render-root-frame";
import { CliThemeProvider } from "../../../../theme/provider";
import {
  FooterProbe,
  flush,
  makeAgent,
  makeContextSnapshot,
  renderView,
} from "../../testing/progress-view";
import { ReviewProgressView } from "./view";

// renderView does not mount GlobalLayout; derive the content zone from the
// rendered terminal with the real row math. Hoisted here so it registers
// before the render-root-frame import instantiates the app tree.
vi.mock("../../../../components/layout/global", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../components/layout/global")>();
  const { useTerminalDimensions } = await import("../../../../hooks/use-terminal-dimensions");
  return {
    ...actual,
    useContentZone: () => {
      const { columns, rows } = useTerminalDimensions();
      return {
        columns,
        contentRows: actual.getContentZoneRows(rows),
        contentColumns: columns,
      };
    },
  };
});

afterEach(() => {
  cleanup();
  cleanupRootFrames();
  vi.useRealTimers();
});

describe("ReviewProgressView (TUI) status", () => {
  test("renders the rate-limited partial-failure warning in the terminal callout", () => {
    const failedAgent: AgentState = {
      id: "guardian",
      meta: AGENT_METADATA.guardian,
      status: "error",
      progress: 100,
      issueCount: 0,
    };

    const { lastFrame } = renderView({
      agents: [failedAgent],
      lensStats: [
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "RATE_LIMITED" },
      ],
    });

    const frame = lastFrame() ?? "";
    expect(frame).toContain("1 agent failed (rate limited): Guardian.");
    expect(frame).toContain("Results may");
    expect(frame).toContain("be incomplete.");
  });

  test("renders streamed server notices in the activity pane", () => {
    const { lastFrame } = renderView({
      notices: ["Event stream truncated: showing the first 500 events."],
    });

    expect(lastFrame() ?? "").toContain("Event stream truncated: showing the first 500 events.");
  });

  test("shows the settings action for an API-key stream error", () => {
    const { lastFrame } = renderView({
      isStreaming: false,
      error: "Provider rejected the API key",
      errorCode: "API_KEY_MISSING",
      transportFamily: "hosted-api",
      onGoToSettings: vi.fn(),
    });

    const frame = lastFrame() ?? "";
    expect(frame).toContain("API Key Error");
    expect(frame).toContain("Your API key may be invalid or expired.");
    // The recovery lives in the shortcut bar, and the callout says which key.
    expect(frame).toContain("Press s to open Settings.");
    expect(frame).not.toContain("Cancel");
  });

  test("does not offer API key recovery on a local transport", () => {
    const { lastFrame } = renderView({
      isStreaming: false,
      error: "Provider rejected the API key",
      errorCode: "API_KEY_MISSING",
      transportFamily: "local-cli",
      onGoToSettings: vi.fn(),
    });

    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("API Key Error");
    expect(frame).toContain("Review Error");
  });

  test("reaches settings from the API-key error through the s key alone", async () => {
    const onGoToSettings = vi.fn();
    const { stdin, lastFrame } = renderView({
      isStreaming: false,
      error: "Provider rejected the API key",
      errorCode: "API_KEY_MISSING",
      transportFamily: "hosted-api",
      onGoToSettings,
    });

    await vi.waitFor(() => expect(lastFrame() ?? "").toContain("API Key Error"));
    stdin.write("s");
    await flush();

    expect(onGoToSettings).toHaveBeenCalledTimes(1);
  });

  test("labels prompt inclusion without claiming model analysis is complete", () => {
    const { lastFrame } = renderView({
      fileProgress: {
        total: 2,
        completed: ["src/a.ts", "src/b.ts"],
      },
    });

    // The metric label and value are separately coloured Text nodes, so the raw
    // frame splits them with an escape sequence whenever colour is on — which
    // would also let the negative assertion below pass for the wrong reason.
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Files in Prompt: 2/2");
    expect(frame).not.toContain("Files processed");
  });

  test("cycles the activity log through per-agent source filters", async () => {
    const { lastFrame, stdin } = renderView({
      agents: [makeAgent("detective"), makeAgent("guardian")],
      events: [
        {
          type: "agent_thinking",
          agent: "detective",
          thought: "detective-only-event",
          timestamp: "2026-01-01T00:00:01.000Z",
        },
        {
          type: "agent_thinking",
          agent: "guardian",
          thought: "guardian-only-event",
          timestamp: "2026-01-01T00:00:02.000Z",
        },
      ],
    });

    stdin.write("f");
    await flush();

    expect(lastFrame() ?? "").toContain("Filter [f]: Detective");
    expect(lastFrame() ?? "").toContain("detective-only-event");
    expect(lastFrame() ?? "").not.toContain("guardian-only-event");
  });

  test("publishes the context save action after streaming completes", async () => {
    const { lastFrame } = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewProgressView
            progressSteps={[]}
            agents={[]}
            events={[]}
            fileProgress={{ total: 0, completed: [] }}
            isStreaming={false}
            error={null}
            notices={[]}
            issuesFound={0}
            startedAt={null}
            completedAt={null}
            contextSnapshot={makeContextSnapshot()}
          />
          <FooterProbe />
        </CliThemeProvider>
      </FooterProvider>,
    );

    await vi.waitFor(() => expect(lastFrame() ?? "").toContain("w Save context"));
  });
});
