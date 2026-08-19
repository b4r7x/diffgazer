import { makeReadyInitResponse } from "@diffgazer/core/testing/provider-fixtures";
import { cleanup } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiBoundary } from "../../../testing/api-boundary";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { HomeScreen } from "./screen";

const renderHome = () => (
  <ApiBoundary api={{ saveSettings: saveSettingsMock }}>
    <HomeScreen />
  </ApiBoundary>
);

const useConfigurationInitMock = vi.hoisted(() => vi.fn());
const refetchInitMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
const saveSettingsMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useConfigurationInit: useConfigurationInitMock,
    useReviews: () => ({ data: { reviews: [] } }),
    useActiveReviewSession: () => ({ data: { session: null } }),
    useSaveTrust: () => ({ error: null, isPending: false, mutate: () => {} }),
    useShutdown: () => ({ mutate: () => {} }),
  };
});

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({ columns: 100, rows: 30, isNarrow: false }),
  useTerminalDimensions: () => ({ columns: 100, rows: 30 }),
}));
vi.mock("../../../hooks/use-back-handler", () => ({ useBackHandler: () => {} }));
vi.mock("../../../hooks/use-exit", () => ({ useExit: () => ({ handleExit: () => {} }) }));
vi.mock("@diffgazer/core/footer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/footer")>();
  return { ...actual, usePageFooter: () => {} };
});

function makeInitResponse() {
  return {
    ...makeReadyInitResponse(),
    settings: {
      theme: "dark" as const,
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low" as const,
      secretsStorage: "file" as const,
      agentExecution: "sequential" as const,
      providerConsent: null,
    },
    project: {
      projectId: "project-1",
      path: "/tmp/repo",
      trust: null,
    },
  };
}

afterEach(() => {
  cleanup();
  cleanupRootFrames();
  vi.clearAllMocks();
});

beforeEach(() => {
  useConfigurationInitMock.mockReset();
  useConfigurationInitMock.mockReturnValue({
    data: makeInitResponse(),
    isLoading: false,
    error: null,
    refetch: refetchInitMock,
  });
});

describe("HomeScreen", () => {
  test("keeps the untrusted action inside an 80 by 24 root frame", async () => {
    useConfigurationInitMock.mockReturnValue({
      data: makeInitResponse(),
      isLoading: false,
      error: null,
      refetch: refetchInitMock,
    });

    const { lastFrame } = renderRootFrame(80, 24, renderHome());

    await vi.waitFor(() => expect(lastFrame()).toContain("Trust & Continue"));
    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("First-Time Setup");
    expect(frame).toContain("SECURITY WARNING");
  });

  test("asks for the provider consent before the first review: Escape declines, Enter accepts once", async () => {
    const init = makeInitResponse();
    useConfigurationInitMock.mockReturnValue({
      data: {
        ...init,
        project: {
          ...init.project,
          trust: {
            projectId: "project-1",
            repoRoot: "/tmp/repo",
            trustedAt: "2026-01-01T00:00:00.000Z",
            trustMode: "persistent" as const,
            capabilities: { readFiles: true, runCommands: false },
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: refetchInitMock,
    });

    const { stdin, lastFrame } = renderRootFrame(100, 30, renderHome());
    await vi.waitFor(() => expect(lastFrame()).toContain("Review Unstaged"));

    // Enter on the highlighted Review Unstaged row.
    stdin.write("\r");
    await vi.waitFor(() => expect(lastFrame()).toContain("Provider data notice"));
    expect(lastFrame()).toContain("[ Accept and continue ]");
    expect(lastFrame()).toContain("[ Not now ]");

    // Not now leaves home usable and records nothing.
    stdin.write("\u001b");
    await vi.waitFor(() => expect(lastFrame()).toContain("Review Unstaged"));
    expect(saveSettingsMock).not.toHaveBeenCalled();

    stdin.write("\r");
    await vi.waitFor(() => expect(lastFrame()).toContain("Provider data notice"));
    stdin.write("\r");
    await vi.waitFor(() => expect(saveSettingsMock).toHaveBeenCalledOnce());
    expect(saveSettingsMock).toHaveBeenCalledWith({
      providerConsent: { version: 1, acceptedAt: expect.any(String) },
    });
  });

  test("keeps the menu row the notice was opened from highlighted after Not now", async () => {
    const init = makeInitResponse();
    useConfigurationInitMock.mockReturnValue({
      data: {
        ...init,
        project: {
          ...init.project,
          trust: {
            projectId: "project-1",
            repoRoot: "/tmp/repo",
            trustedAt: "2026-01-01T00:00:00.000Z",
            trustMode: "persistent" as const,
            capabilities: { readFiles: true, runCommands: false },
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: refetchInitMock,
    });

    const { stdin, lastFrame } = renderRootFrame(100, 30, renderHome());
    await vi.waitFor(() => expect(lastFrame()).toContain("> r. Review Unstaged"));

    // Down to Review Staged, open the notice from it, decline it.
    stdin.write("\u001b[B");
    await vi.waitFor(() => expect(lastFrame()).toContain("> R. Review Staged"));
    stdin.write("\r");
    await vi.waitFor(() => expect(lastFrame()).toContain("Provider data notice"));
    stdin.write("\u001b");
    await vi.waitFor(() => expect(lastFrame()).toContain("> R. Review Staged"));
    expect(lastFrame()).not.toContain("> r. Review Unstaged");
  });
});
