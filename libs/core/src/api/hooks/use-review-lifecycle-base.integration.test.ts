/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "../../result.js";
import type { StreamReviewError } from "../../review/index.js";
import { type SettingsConfig, SettingsConfigSchema } from "../../schemas/config/index.js";
import { type CreateReviewOutcome, ReviewErrorCode } from "../../schemas/review/index.js";
import { createDeferred } from "../../testing/deferred.js";
import { makeActiveReviewSession } from "../../testing/factories.js";
import { makeReadiness } from "../../testing/provider-fixtures.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import type { ResumeReviewResult } from "../review.js";
import type { ReviewContextResponse } from "../types.js";
import { reviewQueries } from "./queries/review.js";
import { useCreateReview } from "./review.js";
import { useReviewLifecycleBase } from "./use-review-lifecycle-base.js";

// Parsed through the real schema so a fixture cannot claim a settings state the
// `getSettings` boundary would reject (for example an empty default-lens list).
function makeSettings(overrides: Partial<SettingsConfig> = {}): SettingsConfig {
  return SettingsConfigSchema.parse({
    theme: "terminal",
    defaultLenses: ["correctness"],
    defaultProfile: null,
    severityThreshold: "low",
    secretsStorage: null,
    agentExecution: "parallel",
    providerConsent: null,
    ...overrides,
  });
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
  ): Partial<BoundApi> {
    return {
      getSettings: vi.fn(async () => makeSettings()),
      resumeReviewStream: vi.fn(async () => resumeResult),
      getReviewContext: vi.fn(),
    };
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
          readiness: makeReadiness("ready"),
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
          readiness: makeReadiness("ready"),
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

  it("exposes a recoverable stream failure on the running gate", async () => {
    const onComplete = vi.fn();
    const onStreamComplete = vi.fn();
    const harness = createTestQueryWrapper({
      api: createLifecycleApi(err({ code: "STREAM_ERROR", message: "network failed" })),
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          readiness: makeReadiness("ready"),
          reviewId: "error-review",
          onComplete,
          onStreamComplete,
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(harness.api.resumeReviewStream).toHaveBeenCalled());
    await waitFor(() => expect(result.current.stream.state.error).toBe("network failed"));

    expect(result.current.stream.state.isStreaming).toBe(false);
    expect(result.current.checks.isTerminalStreamError).toBe(false);
    expect(result.current.gate).toBe("running");
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
          readiness: makeReadiness("ready"),
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
        ...createLifecycleApi(ok({ result: { issues: [] }, reviewId: "local-cancel-review" })),
        cancelReviewSession: vi.fn(async () => ({
          cancelled: true as const,
          reason: "cancelled" as const,
        })),
      },
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          readiness: makeReadiness("ready"),
          reviewId: "local-cancel-review",
          onComplete: vi.fn(),
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(result.current.start.hasStarted).toBe(true));
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
    [ReviewErrorCode.SESSION_EVICTED, "evicted"],
    [ReviewErrorCode.SESSION_TIMEOUT, "timed out"],
    [ReviewErrorCode.SERVER_SHUTDOWN, "shut down"],
    [ReviewErrorCode.SESSION_NOT_FOUND, "not found"],
  ] as const)("does not fire successful completion callbacks for %s resume failures", async (code, message) => {
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
          readiness: makeReadiness("ready"),
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
      expect(onNotFoundInSession).toHaveBeenCalledTimes(1);
      expect(onStaleSession).not.toHaveBeenCalled();
    } else {
      await waitFor(() => expect(onStaleSession).toHaveBeenCalledWith(code));
      expect(onStaleSession).toHaveBeenCalledTimes(1);
      expect(onNotFoundInSession).not.toHaveBeenCalled();
    }

    expect(result.current.completion.isCompleting).toBe(false);
    expect(onStreamComplete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("does not notify after an automatic resume settles after unmount", async () => {
    const resumeDeferred = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const onNotFoundInSession = vi.fn();
    const onStaleSession = vi.fn();
    const harness = createTestQueryWrapper({
      api: {
        getSettings: vi.fn(async () => makeSettings()),
        resumeReviewStream: vi
          .fn<BoundApi["resumeReviewStream"]>()
          .mockReturnValue(resumeDeferred.promise),
      },
    });

    const lifecycle = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          readiness: makeReadiness("ready"),
          reviewId: "deferred-review",
          onComplete: vi.fn(),
          onNotFoundInSession,
          onStaleSession,
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(harness.api.resumeReviewStream).toHaveBeenCalledTimes(1));
    lifecycle.unmount();

    await act(async () => {
      resumeDeferred.resolve(err({ code: ReviewErrorCode.SESSION_STALE, message: "stale" }));
      await resumeDeferred.promise;
    });

    expect(onNotFoundInSession).not.toHaveBeenCalled();
    expect(onStaleSession).not.toHaveBeenCalled();
  });

  it("exposes manual retry as an imperative resume", async () => {
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockResolvedValueOnce(err({ code: "STREAM_ERROR", message: "network failed" }))
      .mockResolvedValueOnce(
        ok({
          reviewId: "manual-review",
          result: { issues: [] },
        }),
      );
    const harness = createTestQueryWrapper({
      api: {
        getSettings: vi.fn(async () => makeSettings()),
        resumeReviewStream,
      },
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          readiness: makeReadiness("ready"),
          reviewId: "manual-review",
          onComplete: vi.fn(),
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(result.current.stream.state.errorCode).toBe("STREAM_ERROR"));

    await act(async () => {
      await result.current.resumeReview("manual-review");
    });

    expect(resumeReviewStream).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.stream.state.hasCompleted).toBe(true));
  });
});

describe("useReviewLifecycleBase transport reconnect", () => {
  function createReconnectHarness() {
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockResolvedValueOnce(err({ code: "STREAM_ERROR", message: "network failed" }))
      .mockResolvedValueOnce(
        ok({
          reviewId: "reconnect-review",
          result: { issues: [] },
        }),
      );
    const harness = createTestQueryWrapper({
      api: {
        getSettings: vi.fn(async () => makeSettings()),
        resumeReviewStream,
      },
    });
    return { harness, resumeReviewStream };
  }

  it("resumes after a transport error when the browser comes back online", async () => {
    const { harness, resumeReviewStream } = createReconnectHarness();

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          readiness: makeReadiness("ready"),
          reviewId: "reconnect-review",
          onComplete: vi.fn(),
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(result.current.stream.state.errorCode).toBe("STREAM_ERROR"));
    expect(resumeReviewStream).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(resumeReviewStream).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.stream.state.hasCompleted).toBe(true));
  });

  it("deduplicates online and visibility reconnects while the retry stream is pending", async () => {
    const secondResume = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockResolvedValueOnce(err({ code: "STREAM_ERROR", message: "network failed" }))
      .mockReturnValueOnce(secondResume.promise);
    const harness = createTestQueryWrapper({
      api: {
        getSettings: vi.fn(async () => makeSettings()),
        resumeReviewStream,
      },
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          readiness: makeReadiness("ready"),
          reviewId: "reconnect-review",
          onComplete: vi.fn(),
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(result.current.stream.state.errorCode).toBe("STREAM_ERROR"));
    expect(resumeReviewStream).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(resumeReviewStream).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondResume.resolve(
        ok({
          reviewId: "reconnect-review",
          result: { issues: [] },
        }),
      );
      await secondResume.promise;
    });

    await waitFor(() => expect(result.current.stream.state.hasCompleted).toBe(true));
    expect(resumeReviewStream).toHaveBeenCalledTimes(2);
  });

  it("resumes after a transport error when the tab becomes visible", async () => {
    const { harness, resumeReviewStream } = createReconnectHarness();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          readiness: makeReadiness("ready"),
          reviewId: "reconnect-review",
          onComplete: vi.fn(),
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(result.current.stream.state.errorCode).toBe("STREAM_ERROR"));

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(resumeReviewStream).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.stream.state.hasCompleted).toBe(true));
  });

  it("does not resume while hidden until the tab becomes visible", async () => {
    const { harness, resumeReviewStream } = createReconnectHarness();
    let visibilityState: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          readiness: makeReadiness("ready"),
          reviewId: "reconnect-review",
          onComplete: vi.fn(),
        }),
      { wrapper: harness.Wrapper },
    );

    await waitFor(() => expect(result.current.stream.state.errorCode).toBe("STREAM_ERROR"));

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(resumeReviewStream).toHaveBeenCalledTimes(1);

    visibilityState = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(resumeReviewStream).toHaveBeenCalledTimes(2));
  });
});

describe("useReviewLifecycleBase create outcome", () => {
  function createOutcomeHarness(outcome: CreateReviewOutcome) {
    const session = makeActiveReviewSession({ mode: "unstaged" });
    return createTestQueryWrapper({
      api: {
        getSettings: vi.fn(async () => makeSettings()),
        createReview: vi.fn(async () => ({ reviewId: session.reviewId, session, outcome })),
        // The stream is attached but silent: nothing has been replayed yet, so
        // the gate under test can only come from the create response.
        resumeReviewStream: vi.fn(() => new Promise<never>(() => {})),
        getReviewContext: vi.fn(),
      },
    });
  }

  function useStartedReview() {
    const create = useCreateReview();
    const [reviewId, setReviewId] = useState<string | undefined>();
    const lifecycle = useReviewLifecycleBase({
      configLoading: false,
      readiness: makeReadiness("ready"),
      reviewId,
      onComplete: vi.fn(),
    });
    return { create, setReviewId, lifecycle };
  }

  it("opens a review the create call already answered on the no-diff gate", async () => {
    const harness = createOutcomeHarness("no-diff");

    const { result } = renderHook(useStartedReview, { wrapper: harness.Wrapper });

    await act(async () => {
      const response = await result.current.create.mutateAsync({ mode: "unstaged" });
      result.current.setReviewId(response.reviewId);
    });

    expect(result.current.lifecycle.gate).toBe("no-diff");
    expect(result.current.lifecycle.checks.isNoDiffError).toBe(true);
    expect(result.current.lifecycle.checks.loadingMessage).toBeNull();
    // No event has been replayed, so the gate is the create response's answer
    // rather than the stream's.
    expect(result.current.lifecycle.stream.state.errorCode).toBeNull();
  });

  it("opens a run the create call already failed on the terminal-error gate", async () => {
    const harness = createOutcomeHarness("failed");

    const { result } = renderHook(useStartedReview, { wrapper: harness.Wrapper });

    await act(async () => {
      const response = await result.current.create.mutateAsync({ mode: "unstaged" });
      result.current.setReviewId(response.reviewId);
    });

    expect(result.current.lifecycle.gate).toBe("terminal-error");
    expect(result.current.lifecycle.checks.isTerminalStreamError).toBe(true);
    expect(result.current.lifecycle.checks.loadingMessage).toBeNull();
    expect(result.current.lifecycle.stream.state.errorCode).toBeNull();
  });

  it("leaves a run the create call reported as running on its running gate", async () => {
    const harness = createOutcomeHarness("running");

    const { result } = renderHook(useStartedReview, { wrapper: harness.Wrapper });

    await act(async () => {
      const response = await result.current.create.mutateAsync({ mode: "unstaged" });
      result.current.setReviewId(response.reviewId);
    });

    expect(result.current.lifecycle.gate).not.toBe("no-diff");
    expect(result.current.lifecycle.checks.isNoDiffError).toBe(false);
    expect(result.current.lifecycle.start.canStart).toBe(true);
  });
});
