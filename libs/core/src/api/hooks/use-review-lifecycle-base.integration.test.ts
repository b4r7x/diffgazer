/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "../../result.js";
import type { StreamReviewError } from "../../review/index.js";
import type { SettingsConfig } from "../../schemas/config/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import { createDeferred } from "../../testing/deferred.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import type { ResumeReviewResult } from "../review.js";
import type { ReviewContextResponse } from "../types.js";
import { reviewQueries } from "./queries/review.js";
import { useReviewLifecycleBase } from "./use-review-lifecycle-base.js";

function makeSettings(overrides: Partial<SettingsConfig> = {}): SettingsConfig {
  return {
    theme: "terminal",
    defaultLenses: [],
    defaultProfile: null,
    severityThreshold: "low",
    secretsStorage: null,
    agentExecution: "parallel",
    ...overrides,
  };
}

function makeContextResponse(label: string): ReviewContextResponse {
  const generatedAt = "2026-07-15T12:00:00.000Z";
  return {
    text: `context-${label}`,
    markdown: `# Context ${label}`,
    graph: {
      generatedAt,
      root: "/tmp/repo",
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
    },
    meta: {
      generatedAt,
      root: "/tmp/repo",
      statusHash: `status-${label}`,
      statusHashKind: "full",
      charCount: `context-${label}`.length,
    },
  };
}

describe("useReviewLifecycleBase terminal resume states", () => {
  function createLifecycleApi(
    resumeResult: Result<ResumeReviewResult, StreamReviewError>,
  ): BoundApi {
    return {
      getSettings: vi.fn(async () => makeSettings()),
      resumeReviewStream: vi.fn(async () => resumeResult),
      getReviewContext: vi.fn(),
    } as unknown as BoundApi;
  }

  it("replaces a fresh cached snapshot A with B after B's context step completes", async () => {
    const snapshotA = makeContextResponse("A");
    const snapshotB = makeContextResponse("B");
    const snapshotBRequest = createDeferred<ReviewContextResponse>();
    const streamResult = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const getReviewContext = vi
      .fn<BoundApi["getReviewContext"]>()
      .mockResolvedValueOnce(snapshotA)
      .mockImplementationOnce(() => snapshotBRequest.promise);
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockImplementation((streamOptions) => {
        streamOptions.onStepEvent?.({
          type: "step_complete",
          step: "context",
          timestamp: "2026-07-15T12:00:01.000Z",
        });
        return streamResult.promise;
      });
    const harness = createTestQueryWrapper({
      api: {
        getSettings: vi.fn(async () => makeSettings()),
        getReviewContext,
        resumeReviewStream,
      },
    });

    await harness.queryClient.fetchQuery(reviewQueries.context(harness.api));
    expect(getReviewContext).toHaveBeenCalledTimes(1);

    const lifecycle = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          isConfigured: true,
          reviewId: "review-b",
          onComplete: vi.fn(),
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(resumeReviewStream).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getReviewContext).toHaveBeenCalledTimes(2));
    expect(lifecycle.result.current.contextSnapshot).toBeNull();

    snapshotBRequest.resolve(snapshotB);
    await waitFor(() => expect(lifecycle.result.current.contextSnapshot).toEqual(snapshotB));

    expect(harness.queryClient.getQueryData(reviewQueries.context(harness.api).queryKey)).toEqual(
      snapshotB,
    );

    streamResult.resolve(
      ok({
        reviewId: "review-b",
        result: { issues: [] },
      }),
    );
    await act(async () => streamResult.promise);
    lifecycle.unmount();
  });

  it("completes when a successful resume resolves before a streaming render commits", async () => {
    const onComplete = vi.fn();
    const onStreamComplete = vi.fn();
    const harness = createTestQueryWrapper({
      api: createLifecycleApi(
        ok({
          reviewId: "completed-review",
          result: { issues: [] },
        }),
      ),
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          isConfigured: true,
          reviewId: "completed-review",
          onComplete,
          onStreamComplete,
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(harness.api.resumeReviewStream).toHaveBeenCalled());
    await waitFor(() => expect(result.current.stream.state.hasCompleted).toBe(true));
    await waitFor(() => expect(onStreamComplete).toHaveBeenCalledTimes(1));

    expect(result.current.stream.state.isStreaming).toBe(false);
    expect(result.current.completion.isCompleting).toBe(true);
    const completedAt = result.current.completion.completedAt;
    expect(completedAt).toBeInstanceOf(Date);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      result.current.completion.skipDelay();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.completion.completedAt).toBe(completedAt);
  });

  it("exposes a generic stream failure as terminal and not running", async () => {
    const onComplete = vi.fn();
    const onStreamComplete = vi.fn();
    const harness = createTestQueryWrapper({
      api: createLifecycleApi(err({ code: "STREAM_ERROR", message: "network failed" })),
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          isConfigured: true,
          reviewId: "error-review",
          onComplete,
          onStreamComplete,
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(harness.api.resumeReviewStream).toHaveBeenCalled());
    await waitFor(() => expect(result.current.stream.state.error).toBe("network failed"));

    expect(result.current.stream.state.isStreaming).toBe(false);
    expect(result.current.checks.isTerminalStreamError).toBe(true);
    expect(result.current.gate).toBe("terminal-error");
    expect(onStreamComplete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("exposes a resumed remote cancel with a message as terminal", async () => {
    const onComplete = vi.fn();
    const onStreamComplete = vi.fn();
    const harness = createTestQueryWrapper({
      api: createLifecycleApi(
        err({ code: ReviewErrorCode.CANCELLED, message: "Review was cancelled remotely." }),
      ),
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          isConfigured: true,
          reviewId: "remote-cancel-review",
          onComplete,
          onStreamComplete,
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(harness.api.resumeReviewStream).toHaveBeenCalled());
    await waitFor(() =>
      expect(result.current.stream.state.error).toBe("Review was cancelled remotely."),
    );

    expect(result.current.stream.state.isStreaming).toBe(false);
    expect(result.current.stream.state.errorCode).toBe(ReviewErrorCode.CANCELLED);
    expect(result.current.checks.isTerminalStreamError).toBe(true);
    expect(result.current.gate).toBe("terminal-error");
    expect(onStreamComplete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("keeps a local self-cancel without an error non-terminal", async () => {
    const harness = createTestQueryWrapper({
      api: {
        getSettings: vi.fn(async () => makeSettings()),
        cancelReviewSession: vi.fn(async () => ({
          cancelled: true as const,
          reason: "cancelled" as const,
        })),
        getReviewContext: vi.fn(),
        resumeReviewStream: vi.fn(),
      },
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          isConfigured: true,
          onComplete: vi.fn(),
        }),
      { wrapper: harness.Wrapper },
    );

    act(() => {
      result.current.start.setHasStarted(true);
    });
    await waitFor(() => expect(result.current.checks.loadingMessage).toBeNull());

    await act(async () => {
      await result.current.stream.cancel("local-cancel-review");
    });

    expect(harness.api.cancelReviewSession).toHaveBeenCalledWith("local-cancel-review");
    expect(result.current.stream.state.error).toBeNull();
    expect(result.current.stream.state.errorCode).toBe(ReviewErrorCode.CANCELLED);
    expect(result.current.checks.isTerminalStreamError).toBe(false);
    expect(result.current.gate).toBe("running");
  });

  it.each([
    [ReviewErrorCode.SESSION_STALE, "stale"],
    [ReviewErrorCode.SESSION_NOT_FOUND, "not found"],
  ])("does not fire successful completion callbacks for %s resume failures", async (code, message) => {
    const onComplete = vi.fn();
    const onStreamComplete = vi.fn();
    const onNotFoundInSession = vi.fn();
    const onStaleSession = vi.fn();
    const harness = createTestQueryWrapper({
      api: createLifecycleApi(err({ code, message })),
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          isConfigured: true,
          reviewId: "terminal-review",
          onComplete,
          onStreamComplete,
          onNotFoundInSession,
          onStaleSession,
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(harness.api.resumeReviewStream).toHaveBeenCalled());
    if (code === ReviewErrorCode.SESSION_NOT_FOUND) {
      await waitFor(() => expect(onNotFoundInSession).toHaveBeenCalledWith("terminal-review"));
    } else {
      await waitFor(() => expect(onStaleSession).toHaveBeenCalledWith(code));
    }

    expect(result.current.completion.isCompleting).toBe(false);
    expect(onStreamComplete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
