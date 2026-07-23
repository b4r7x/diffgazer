import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { HomeScreen } from "./screen";

const trustVar = vi.hoisted(() => ({ trust: null as unknown }));

function initData() {
  return {
    configPath: "/tmp/diffgazer/config.json",
    config: { provider: "gemini", model: "gemini-2.5-flash" },
    providers: [],
    settings: {
      theme: "dark",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: "file",
      agentExecution: "sequential",
    },
    configured: true,
    project: { projectId: "project-1", path: "/tmp/repo", trust: trustVar.trust },
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
  useInit: () => ({ data: initData(), error: null, isLoading: false, refetch: vi.fn() }),
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
    const { lastFrame } = renderRootFrame(80, 24, <HomeScreen />);

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

  test("renders the trusted Last Run id as one #-prefixed token at 80x24", async () => {
    trustVar.trust = {
      repoRoot: "/tmp/repo",
      capabilities: { readFiles: true, runCommands: false },
    };
    const { lastFrame } = renderRootFrame(80, 24, <HomeScreen />);

    await vi.waitFor(() => expect(lastFrame()).toContain("Last Run"));
    const frame = stripAnsi(lastFrame() ?? "");

    // The run id renders as a single token, not split across wrapped rows with
    // the issue-count paren bleeding into it ("#c (8").
    expect(frame).toMatch(/#[0-9a-f]{2,}/);
    expect(frame).not.toMatch(/#\w\s*\(/);
  });
});
