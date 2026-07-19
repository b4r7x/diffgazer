import { cleanup } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { HomeScreen } from "./screen";

const initData = {
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
  project: { projectId: "project-1", path: "/tmp/repo", trust: null },
  setup: {
    hasSecretsStorage: true,
    hasProvider: true,
    hasModel: true,
    hasTrust: false,
    isConfigured: true,
    isReady: false,
    missing: ["trust"],
  },
};

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useInit: () => ({ data: initData, error: null, isLoading: false, refetch: vi.fn() }),
  useReviews: () => ({ data: { reviews: [] } }),
  useActiveReviewSession: () => ({ data: { session: null } }),
  useShutdown: () => ({ mutate: vi.fn() }),
  useSaveTrust: () => ({ isPending: false, error: null, mutate: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  cleanupRootFrames();
});

describe("HomeScreen", () => {
  test("keeps the untrusted action inside an 80 by 24 root frame", async () => {
    const { lastFrame } = renderRootFrame(80, 24, <HomeScreen />);

    await vi.waitFor(() => expect(lastFrame()).toContain("Trust & Continue"));
    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("First-Time Setup");
    expect(frame).toContain("SECURITY WARNING:");
    expect(frame.split("\n")).toHaveLength(24);
  });
});
