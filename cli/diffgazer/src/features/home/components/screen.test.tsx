import { makeReadyInitResponse } from "@diffgazer/core/testing/provider-fixtures";
import { cleanup } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { HomeScreen } from "./screen";

const useConfigurationInitMock = vi.hoisted(() => vi.fn());
const refetchInitMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));

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

    const { lastFrame } = renderRootFrame(80, 24, <HomeScreen />);

    await vi.waitFor(() => expect(lastFrame()).toContain("Trust & Continue"));
    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("First-Time Setup");
    expect(frame).toContain("SECURITY WARNING");
  });
});
