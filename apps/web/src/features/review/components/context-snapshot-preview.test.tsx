import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider, useReviewLifecycleBase } from "@diffgazer/core/api/hooks";
import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { FooterProvider } from "@diffgazer/core/footer";
import { ok } from "@diffgazer/core/result";
import { mapStepsToProgressData } from "@diffgazer/core/review";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ReviewProgressView } from "./progress-view";

const downloadAsFile = vi.hoisted(() => vi.fn());

vi.mock("@/utils/download", () => ({ downloadAsFile }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

function makeSettings(): SettingsConfig {
  return {
    theme: "terminal",
    defaultLenses: [],
    defaultProfile: null,
    severityThreshold: "low",
    secretsStorage: null,
    agentExecution: "parallel",
  };
}

function makeSnapshot(label: string): ReviewContextResponse {
  const generatedAt = "2026-07-15T12:00:00.000Z";
  return {
    text: `context-${label}`,
    markdown: `# Context ${label}`,
    graph: {
      generatedAt,
      root: `/tmp/repo-${label.toLowerCase()}`,
      packages: [{ name: "web", dir: "apps/web", kind: "app" }],
      edges: [],
      fileTree: [],
      changedFiles: [
        {
          filePath: "src/index.ts",
          operation: "modified",
          additions: 3,
          deletions: 1,
        },
      ],
    },
    meta: {
      generatedAt,
      root: `/tmp/repo-${label.toLowerCase()}`,
      statusHash: `status-${label}`,
      statusHashKind: "full",
      charCount: `context-${label}`.length,
    },
  };
}

function createWrapper(api: BoundApi, queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <KeyboardProvider>
            <FooterProvider>{children}</FooterProvider>
          </KeyboardProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  };
}

function LifecycleProgressHarness() {
  const lifecycle = useReviewLifecycleBase({
    configLoading: false,
    isConfigured: true,
    reviewId: "review-b",
    onComplete: vi.fn(),
  });
  const { state } = lifecycle.stream;

  return (
    <ReviewProgressView
      data={{
        steps: mapStepsToProgressData(state.steps),
        events: state.events,
        agents: state.agents,
        metrics: {
          filesProcessed: state.fileProgress.completed.length,
          filesTotal: state.fileProgress.total,
          issuesFound: state.issues.length,
        },
        startTime: state.startedAt ?? undefined,
        contextSnapshot: lifecycle.contextSnapshot,
        notices: state.notices,
      }}
      isRunning={state.isStreaming}
    />
  );
}

describe("review context lifecycle integration", () => {
  it("replaces cached A, renders refetched B in ProgressView, and downloads every B representation", async () => {
    const user = userEvent.setup();
    const snapshotA = makeSnapshot("A");
    const snapshotB = makeSnapshot("B");
    const snapshotBRequest = createDeferred<ReviewContextResponse>();
    const streamResult = createDeferred<Awaited<ReturnType<BoundApi["resumeReviewStream"]>>>();
    const getReviewContext = vi
      .fn<BoundApi["getReviewContext"]>()
      .mockImplementation(() => snapshotBRequest.promise);
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockImplementation((options) => {
        options.onStepEvent?.({
          type: "step_complete",
          step: "context",
          timestamp: "2026-07-15T12:00:01.000Z",
        });
        return streamResult.promise;
      });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getSettings: vi.fn(async () => makeSettings()),
      getReviewContext,
      resumeReviewStream,
    } satisfies BoundApi;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["review", "context"], snapshotA);

    render(<LifecycleProgressHarness />, { wrapper: createWrapper(api, queryClient) });

    await waitFor(() => expect(getReviewContext).toHaveBeenCalledOnce());
    expect(screen.queryByText("context-A")).not.toBeInTheDocument();

    snapshotBRequest.resolve(snapshotB);
    streamResult.resolve(
      ok({
        reviewId: "review-b",
        result: { issues: [] },
      }),
    );

    expect(await screen.findByText("context-B")).toBeInTheDocument();
    expect(screen.getByText("1 changed file")).toBeInTheDocument();
    expect(screen.getByText("+3 / -1")).toBeInTheDocument();
    expect(getReviewContext).toHaveBeenCalledOnce();

    const downloadActions = screen.getByRole("group", { name: "Download context snapshot" });
    const downloadButtons = within(downloadActions).getAllByRole("button");
    expect(downloadButtons).toHaveLength(3);
    expect(downloadButtons[0]).toHaveAccessibleName("Download .txt");
    expect(downloadButtons[1]).toHaveAccessibleName("Download .md");
    expect(downloadButtons[2]).toHaveAccessibleName("Download .json");

    for (const button of downloadButtons) await user.click(button);

    expect(downloadAsFile).toHaveBeenNthCalledWith(1, "context-B", "context.txt", "text/plain");
    expect(downloadAsFile).toHaveBeenNthCalledWith(2, "# Context B", "context.md", "text/markdown");
    expect(downloadAsFile).toHaveBeenNthCalledWith(
      3,
      JSON.stringify(snapshotB.graph, null, 2),
      "context.json",
      "application/json",
    );
  });
});
