import type { ConfigurationInitResponse } from "@diffgazer/core/schemas/config";
import { makeReadyInitResponse } from "@diffgazer/core/testing/provider-fixtures";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiBoundary } from "../../../testing/api-boundary";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { expectSingleHeavyCornerPane } from "../../../testing/reticle";
import { HomeScreen } from "./screen";

const trustVar = vi.hoisted(() => ({ trust: null as unknown }));

function initData() {
  const init = makeReadyInitResponse();
  return {
    ...init,
    settings: {
      ...init.settings,
      theme: "dark" as const,
      secretsStorage: "file" as const,
      agentExecution: "sequential" as const,
    },
    project: {
      projectId: "project-1",
      path: "/tmp/repo",
      trust: trustVar.trust as ConfigurationInitResponse["project"]["trust"],
    },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: trustVar.trust !== null,
      isConfigured: true,
      isReady: trustVar.trust !== null,
      missing: trustVar.trust !== null ? [] : ["trust"],
    },
  };
}

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useConfigurationInit: () => ({
    data: initData(),
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useReviews: () => ({
    data: {
      reviews: [
        {
          id: "c0ffee00-1234-4567-89ab-cdef01234567",
          projectPath: "/tmp/repo",
          createdAt: "2026-07-18T10:33:48.000Z",
          mode: "unstaged",
          branch: "feature/mobile-tui-parity",
          issueCount: 8,
          blockerCount: 1,
          highCount: 2,
          fileCount: 23,
          durationMs: 42780,
        },
      ],
    },
  }),
  useActiveReviewSession: () => ({ data: { session: null } }),
  useShutdown: () => ({ mutate: vi.fn() }),
  useSaveTrust: () => ({ isPending: false, error: null, mutate: vi.fn() }),
}));

afterEach(() => {
  cleanupRootFrames();
});

describe("HomeScreen context sidebar floor", () => {
  test("keeps the untrusted CTA truncated so the header survives at 80x24", async () => {
    trustVar.trust = null;
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ApiBoundary>
        <HomeScreen />
      </ApiBoundary>,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("SECURITY WARNING"));
    const frame = stripAnsi(lastFrame() ?? "");
    const lines = frame.split("\n");

    // The sidebar must stay inside the content zone; when it overflows, the
    // clamped root shrinks the header and clips the wordmark row.
    expect(frame).toContain("diffgazer");
    // The untrusted "Open Settings ..." CTA must truncate, never fragment into
    // one-syllable-per-row shards.
    expect(lines.some((line) => /^\s*gs →/.test(line))).toBe(false);
    expect(lines.some((line) => /^\s*sions\b/.test(line))).toBe(false);
    expect(lines).toHaveLength(24);
  });

  test.each([
    [100, 30],
    [80, 24],
  ])("fills the content zone down to the shortcut bar at %ix%i", async (columns, rows) => {
    trustVar.trust = {
      repoRoot: "/tmp/repo",
      capabilities: { readFiles: true, runCommands: false },
    };
    const { lastFrame } = renderRootFrame(
      columns,
      rows,
      <ApiBoundary>
        <HomeScreen />
      </ApiBoundary>,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("Main Menu"));
    const lines = stripAnsi(lastFrame() ?? "").split("\n");
    const bottomBorder = lines.findLastIndex((line) => /[└┗]/.test(line));

    expect(bottomBorder).toBeGreaterThan(0);
    // Only the shortcut bar may follow the panels: the frame and the key bar
    // are one bottom-locked assembly, never a ragged gap.
    expect(lines.length - 1 - bottomBorder).toBeLessThanOrEqual(1);
  });

  test("gives the context sidebar its full clamped width instead of shrinking it", async () => {
    trustVar.trust = {
      repoRoot: "/tmp/repo",
      capabilities: { readFiles: true, runCommands: false },
    };
    const { lastFrame } = renderRootFrame(
      100,
      30,
      <ApiBoundary>
        <HomeScreen />
      </ApiBoundary>,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("Last Run"));
    const topBorder =
      stripAnsi(lastFrame() ?? "")
        .split("\n")
        .find((line) => line.includes("┌")) ?? "";

    // clamp(floor(96 * 0.38), 28, 44) = 36 columns, borders included.
    expect(topBorder.indexOf("┐") - topBorder.indexOf("┌") + 1).toBe(36);
    // The budget the clamp buys is spent on the values the sidebar exists for.
    expect(lastFrame()).toContain("#c0ffee00 (8 issues)");
  });

  test("stacks both panes at 60x24 instead of letting the context swallow the frame", async () => {
    trustVar.trust = {
      repoRoot: "/tmp/repo",
      capabilities: { readFiles: true, runCommands: false },
    };
    const { lastFrame } = renderRootFrame(
      60,
      24,
      <ApiBoundary>
        <HomeScreen />
      </ApiBoundary>,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("Main Menu"));
    const frame = stripAnsi(lastFrame() ?? "");

    // Stacked, the menu is below the context pane: it must keep its rows, not
    // be squeezed down to a border sliver.
    expect(frame).toContain("Context");
    expect(frame).toContain("Review Unstaged");
    expect(frame).toContain("Quit");
  });

  test("marks one pane with the heavy-corner reticle", async () => {
    trustVar.trust = {
      repoRoot: "/tmp/repo",
      capabilities: { readFiles: true, runCommands: false },
    };
    const { lastFrame } = renderRootFrame(
      100,
      30,
      <ApiBoundary>
        <HomeScreen />
      </ApiBoundary>,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("Main Menu"));
    expectSingleHeavyCornerPane(lastFrame());
  });

  test("renders the trusted Last Run id as one #-prefixed token at 80x24", async () => {
    trustVar.trust = {
      repoRoot: "/tmp/repo",
      capabilities: { readFiles: true, runCommands: false },
    };
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ApiBoundary>
        <HomeScreen />
      </ApiBoundary>,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("Last Run"));
    const frame = stripAnsi(lastFrame() ?? "");

    // The run id renders as a single token, not split across wrapped rows with
    // the issue-count paren bleeding into it ("#c (8").
    expect(frame).toMatch(/#[0-9a-f]{2,}/);
    expect(frame).not.toMatch(/#\w\s*\(/);
  });
});
