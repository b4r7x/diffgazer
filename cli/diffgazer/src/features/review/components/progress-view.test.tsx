import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { AGENT_METADATA, type AgentId, type AgentState } from "@diffgazer/core/schemas/events";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { CliThemeProvider } from "../../../theme/provider";
import { ReviewProgressView, type ReviewProgressViewProps } from "./progress-view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

afterEach(() => {
  cleanup();
  cleanupRootFrames();
  vi.useRealTimers();
});

function makeAgent(id: AgentId): AgentState {
  return {
    id,
    meta: AGENT_METADATA[id],
    status: "queued",
    progress: 0,
    issueCount: 0,
    currentAction: "reportqueued",
  };
}

function FooterProbe() {
  const { shortcuts } = useFooterData();
  return <Text>{shortcuts.map(({ key, label }) => `${key} ${label}`).join(", ")}</Text>;
}

function makeContextSnapshot(): ReviewContextResponse {
  return {
    text: "context",
    markdown: "# Context",
    graph: {
      generatedAt: "2026-01-01T00:00:00.000Z",
      root: "/repo",
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
    },
    meta: {
      generatedAt: "2026-01-01T00:00:00.000Z",
      root: "/repo",
      statusHash: "hash",
      statusHashKind: "full",
      charCount: 7,
    },
  };
}

async function flush(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function renderViewNode(overrides: Partial<ReviewProgressViewProps> = {}) {
  return (
    <FooterProvider initialShortcuts={[]}>
      <CliThemeProvider initialTheme="dark">
        <ReviewProgressView
          progressSteps={[{ id: "parse", label: "Parse diff", status: "completed" }]}
          agents={[]}
          events={[]}
          fileProgress={{ total: 0, current: 0, currentFile: null, completed: [] }}
          isStreaming
          error={null}
          notices={[]}
          issuesFound={0}
          startedAt={null}
          completedAt={null}
          {...overrides}
        />
      </CliThemeProvider>
    </FooterProvider>
  );
}

function renderView(overrides: Partial<ReviewProgressViewProps> = {}) {
  return render(renderViewNode(overrides));
}

describe("ReviewProgressView (TUI) notices", () => {
  test.each([
    {
      errorCode: "MODEL_ERROR",
      failure: "1 agent failed: Guardian.",
    },
    {
      errorCode: "RATE_LIMITED",
      failure: "1 agent failed (rate limited): Guardian.",
    },
  ])("renders the warning classified by latest $errorCode lens stats", ({ errorCode, failure }) => {
    const failedAgent: AgentState = {
      id: "guardian",
      meta: AGENT_METADATA.guardian,
      status: "error",
      progress: 100,
      issueCount: 0,
    };

    const { lastFrame } = renderView({
      agents: [failedAgent],
      lensStats: [{ lensId: "security", issueCount: 0, status: "failed", errorCode }],
    });

    const frame = lastFrame() ?? "";
    expect(frame).toContain(failure);
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
      onGoToSettings: vi.fn(),
    });

    const frame = lastFrame() ?? "";
    expect(frame).toContain("API Key Error");
    expect(frame).toContain("Your API key may be invalid or expired.");
    expect(frame).toContain("Go to Settings");
    expect(frame).not.toContain("Cancel");
  });

  test("labels prompt inclusion without claiming model analysis is complete", () => {
    const { lastFrame } = renderView({
      fileProgress: {
        total: 2,
        current: 2,
        currentFile: null,
        completed: ["src/a.ts", "src/b.ts"],
      },
    });

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Files in Prompt: 2/2");
    expect(frame).not.toContain("Files processed");
  });

  test("publishes the context save action after streaming completes", async () => {
    const { lastFrame } = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewProgressView
            progressSteps={[]}
            agents={[]}
            events={[]}
            fileProgress={{ total: 0, current: 0, currentFile: null, completed: [] }}
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

  test("cycles the activity log through per-agent source filters", async () => {
    const { lastFrame, stdin } = renderView({
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

  test("fits realistic progress content into an 80 by 24 root frame", async () => {
    const agents = (["detective", "guardian", "optimizer", "simplifier", "tester"] as const).map(
      makeAgent,
    );
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewProgressView
        progressSteps={[
          { id: "context", label: "Build context", status: "completed" },
          { id: "review", label: "Review issues", status: "active" },
          { id: "report", label: "Build report", status: "pending" },
        ]}
        agents={agents}
        events={[]}
        fileProgress={{
          total: 12,
          current: 4,
          currentFile:
            "packages/review/src/generated/deeply/nested/current-file-with-a-long-name.typescript.ts",
          completed: [],
        }}
        isStreaming
        error={null}
        notices={["One agent is waiting for capacity."]}
        onCancel={vi.fn()}
        onBack={vi.fn()}
        issuesFound={3}
        startedAt={new Date("2026-01-01T00:00:00.000Z")}
        completedAt={null}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("Review issues"));
    const frame = lastFrame() ?? "";
    expect(frame.split("\n")).toHaveLength(24);
    expect(frame).not.toContain("reportqueued");
  });

  test("keeps the activity pane and actions visible in a narrow root frame", async () => {
    const { lastFrame } = renderRootFrame(
      60,
      24,
      <ReviewProgressView
        progressSteps={[
          { id: "context", label: "Build context", status: "completed" },
          { id: "review", label: "Review issues", status: "active" },
        ]}
        agents={[]}
        events={[
          {
            type: "agent_thinking",
            agent: "guardian",
            thought: "NARROW-ACTIVITY-VISIBLE",
            timestamp: "2026-01-01T00:00:01.000Z",
          },
        ]}
        fileProgress={{ total: 2, current: 1, currentFile: "src/a.ts", completed: [] }}
        isStreaming
        error={null}
        notices={[]}
        onCancel={vi.fn()}
        issuesFound={0}
        startedAt={null}
        completedAt={null}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("NARROW-ACTIVITY-VISIBLE"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Cancel");
    expect(frame.split("\n")).toHaveLength(24);
  });

  test("keeps the newest activity visible with notices and a partial-failure callout", async () => {
    const failedAgent: AgentState = {
      id: "guardian",
      meta: AGENT_METADATA.guardian,
      status: "error",
      progress: 100,
      issueCount: 0,
    };
    const events = Array.from({ length: 12 }, (_, index) => ({
      type: "agent_thinking" as const,
      agent: "guardian" as const,
      thought: `LOG-EVENT-${index + 1}`,
      timestamp: `2026-01-01T00:00:${String(index + 1).padStart(2, "0")}.000Z`,
    }));
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewProgressView
        progressSteps={[{ id: "review", label: "Review issues", status: "active" }]}
        agents={[failedAgent]}
        lensStats={[{ lensId: "security", issueCount: 0, status: "failed" }]}
        events={events}
        fileProgress={{ total: 1, current: 1, currentFile: null, completed: [] }}
        isStreaming
        error={null}
        notices={["Stream notice"]}
        onCancel={vi.fn()}
        issuesFound={0}
        startedAt={null}
        completedAt={null}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("LOG-EVENT-12"));
    expect(lastFrame()?.split("\n")).toHaveLength(24);
  });

  test("shows compact saved snapshot feedback inside a completed 80 by 24 frame", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "diffgazer-progress-context-"));
    try {
      const { stdin, lastFrame } = renderRootFrame(
        80,
        24,
        <ReviewProgressView
          progressSteps={[{ id: "report", label: "Build report", status: "completed" }]}
          agents={[]}
          events={[]}
          fileProgress={{ total: 1, current: 1, currentFile: null, completed: ["src/a.ts"] }}
          isStreaming={false}
          error={null}
          notices={[]}
          issuesFound={1}
          startedAt={null}
          completedAt={null}
          contextSnapshot={makeContextSnapshot()}
          contextOutputDirectory={outputDirectory}
        />,
      );

      stdin.write("w");
      await vi.waitFor(() => expect(lastFrame()).toContain("Saved: context.txt"));
      const frame = lastFrame() ?? "";
      expect(frame).toContain("context.md · context.json");
      expect(frame.split("\n")).toHaveLength(24);
      expect(await readFile(join(outputDirectory, "context.txt"), "utf8")).toBe("context");
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  test("uses the lifecycle completion timestamp after streaming completes", () => {
    vi.useFakeTimers();
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const completedAt = new Date("2026-01-01T00:00:02.500Z");
    vi.setSystemTime(new Date("2026-01-01T00:00:12.500Z"));

    const { lastFrame } = renderView({
      isStreaming: false,
      startedAt,
      completedAt,
    });

    expect(lastFrame() ?? "").toContain("Elapsed: 00:02");
  });
});

describe("ReviewProgressView (TUI) elapsed time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("advances elapsed time during a silent stream", async () => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(startedAt);

    const { lastFrame } = renderView({
      events: [],
      isStreaming: true,
      startedAt,
    });

    await flush();
    expect(lastFrame() ?? "").toMatch(/Elapsed:\s*00:00/);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    await flush();
    expect(lastFrame() ?? "").toMatch(/Elapsed:\s*00:01/);
  });

  test.each([
    { elapsed: 3_600_000, expected: "60:00" },
    { elapsed: 7_261_000, expected: "121:01" },
  ])("preserves total elapsed minutes at $elapsed ms", ({ elapsed, expected }) => {
    vi.useFakeTimers();

    const { lastFrame } = renderView({
      isStreaming: false,
      startedAt: new Date(Date.now() - elapsed),
      completedAt: new Date(),
    });

    expect(lastFrame() ?? "").toContain(`Elapsed: ${expected}`);
  });
});

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
