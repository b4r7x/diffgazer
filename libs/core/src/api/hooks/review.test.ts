/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "../../result.js";
import type { StreamReviewError } from "../../review/index.js";
import type { SettingsConfig } from "../../schemas/config/index.js";
import {
  type ActiveReviewSession,
  type ActiveReviewSessionResponse,
  ReviewErrorCode,
} from "../../schemas/review/index.js";
import type { BoundApi } from "../bound.js";
import type { ResumeReviewResult } from "../review.js";
import { ApiProvider } from "./context.js";
import { reviewQueries } from "./queries/review.js";
import { useCreateReview, useRefreshReviewContext, useReviewSessionCache } from "./review.js";
import { useReviewLifecycleBase } from "./use-review-lifecycle-controller.js";
import { type UseReviewStartOptions, useReviewStart } from "./use-review-start.js";

function makeWrapper(api: BoundApi, queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
}

function makeActiveSession(overrides: Partial<ActiveReviewSession> = {}): ActiveReviewSession {
  return {
    reviewId: "11111111-1111-4111-8111-111111111111",
    mode: "staged",
    startedAt: "2026-01-01T00:00:00.000Z",
    headCommit: "abc123",
    statusHash: "hash123",
    ...overrides,
  };
}

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

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useRefreshReviewContext", () => {
  let api: BoundApi;
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    api = {
      refreshReviewContext: vi.fn(async () => ({ context: undefined })),
    } as unknown as BoundApi;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  });

  it("invalidates the active context query key", async () => {
    const { result } = renderHook(() => useRefreshReviewContext(), {
      wrapper: makeWrapper(api, queryClient),
    });
    act(() => result.current.mutate(undefined));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidateSpy.mock.calls.map(
      ([arg]: [unknown]) => (arg as { queryKey: unknown[] }).queryKey,
    );
    expect(keys).toContainEqual(reviewQueries.context(api).queryKey);
    expect(reviewQueries.context(api).queryKey).toEqual(["review", "context"]);
  });
});

describe("review active-session cache helpers", () => {
  let api: BoundApi;
  let queryClient: QueryClient;

  beforeEach(() => {
    api = {} as BoundApi;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it("caches the returned active session when a review is created", async () => {
    const session = makeActiveSession({ mode: "unstaged" });
    api = {
      createReview: vi.fn(async () => ({ reviewId: session.reviewId, session })),
    } as unknown as BoundApi;

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: makeWrapper(api, queryClient),
    });

    act(() => {
      result.current.mutate({ mode: "unstaged" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey)).toEqual(
      { session },
    );
    expect(queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
      session,
    });
  });

  it("clears only the active-session cache keys that match the review mode", async () => {
    const staged = makeActiveSession({
      reviewId: "22222222-2222-4222-8222-222222222222",
      mode: "staged",
    });
    const unstaged = makeActiveSession({
      reviewId: "33333333-3333-4333-8333-333333333333",
      mode: "unstaged",
    });
    queryClient.setQueryData(reviewQueries.activeSession(api, "staged").queryKey, {
      session: staged,
    });
    queryClient.setQueryData(reviewQueries.activeSession(api, "unstaged").queryKey, {
      session: unstaged,
    });
    queryClient.setQueryData(reviewQueries.activeSession(api).queryKey, { session: unstaged });

    const { result } = renderHook(() => useReviewSessionCache(), {
      wrapper: makeWrapper(api, queryClient),
    });

    await act(async () => {
      await result.current.clearActiveSession("staged");
    });

    expect(queryClient.getQueryData(reviewQueries.activeSession(api, "staged").queryKey)).toEqual({
      session: null,
    });
    expect(queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey)).toEqual(
      { session: unstaged },
    );
    expect(queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
      session: unstaged,
    });
  });

  it("does not clear a different active session for the same review mode", async () => {
    const active = makeActiveSession({
      reviewId: "22222222-2222-4222-8222-222222222222",
      mode: "staged",
    });
    queryClient.setQueryData(reviewQueries.activeSession(api, "staged").queryKey, {
      session: active,
    });

    const { result } = renderHook(() => useReviewSessionCache(), {
      wrapper: makeWrapper(api, queryClient),
    });

    await act(async () => {
      await result.current.clearActiveSession("staged", "11111111-1111-4111-8111-111111111111");
    });

    expect(queryClient.getQueryData(reviewQueries.activeSession(api, "staged").queryKey)).toEqual({
      session: active,
    });
  });

  it("preserves unstaged active-session keys when the review id does not match", async () => {
    const active = makeActiveSession({
      reviewId: "22222222-2222-4222-8222-222222222222",
      mode: "unstaged",
    });
    queryClient.setQueryData(reviewQueries.activeSession(api, "unstaged").queryKey, {
      session: active,
    });
    queryClient.setQueryData(reviewQueries.activeSession(api).queryKey, {
      session: active,
    });

    const { result } = renderHook(() => useReviewSessionCache(), {
      wrapper: makeWrapper(api, queryClient),
    });

    await act(async () => {
      await result.current.clearActiveSession("unstaged", "11111111-1111-4111-8111-111111111111");
    });

    expect(queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey)).toEqual(
      { session: active },
    );
    expect(queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
      session: active,
    });
  });

  it("mirrors created unstaged active sessions to the unfiltered query key and clears by review id", async () => {
    const unstaged = makeActiveSession({ mode: "unstaged" });
    api = {
      createReview: vi.fn(async () => ({ reviewId: unstaged.reviewId, session: unstaged })),
    } as unknown as BoundApi;

    const { result: createResult } = renderHook(() => useCreateReview(), {
      wrapper: makeWrapper(api, queryClient),
    });

    act(() => {
      createResult.current.mutate({ mode: "unstaged" });
    });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));

    const { result: cacheResult } = renderHook(() => useReviewSessionCache(), {
      wrapper: makeWrapper(api, queryClient),
    });

    expect(queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey)).toEqual(
      { session: unstaged },
    );
    expect(queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
      session: unstaged,
    });

    await act(async () => {
      await cacheResult.current.clearActiveSession("unstaged", unstaged.reviewId);
    });

    expect(queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey)).toEqual(
      { session: null },
    );
    expect(queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
      session: null,
    });
  });

  it("returns a stable cache helper object and clearActiveSession function", () => {
    const { result, rerender } = renderHook(() => useReviewSessionCache(), {
      wrapper: makeWrapper(api, queryClient),
    });
    const firstResult = result.current;
    const firstClearActiveSession = result.current.clearActiveSession;

    rerender();

    expect(result.current).toBe(firstResult);
    expect(result.current.clearActiveSession).toBe(firstClearActiveSession);
  });

  it("keeps a created session when an older active-session request resolves later", async () => {
    const olderSession = makeActiveSession({
      reviewId: "22222222-2222-4222-8222-222222222222",
      mode: "unstaged",
      startedAt: "2026-01-01T00:00:00.000Z",
    });
    const createdSession = makeActiveSession({
      reviewId: "33333333-3333-4333-8333-333333333333",
      mode: "unstaged",
      startedAt: "2026-01-01T00:01:00.000Z",
    });
    const activeSession = createDeferred<ActiveReviewSessionResponse>();
    api = {
      getActiveReviewSession: vi.fn(() => activeSession.promise),
      createReview: vi.fn(async () => ({
        reviewId: createdSession.reviewId,
        session: createdSession,
      })),
    } as unknown as BoundApi;

    const olderFetch = queryClient
      .fetchQuery(reviewQueries.activeSession(api, "unstaged"))
      .catch(() => undefined);
    await waitFor(() => expect(api.getActiveReviewSession).toHaveBeenCalledTimes(1));

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: makeWrapper(api, queryClient),
    });

    act(() => {
      result.current.mutate({ mode: "unstaged" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      activeSession.resolve({ session: olderSession });
      await olderFetch;
    });

    expect(queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey)).toEqual(
      { session: createdSession },
    );
    expect(queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
      session: createdSession,
    });
  });

  it("keeps an active session cleared when older active-session requests resolve later", async () => {
    const session = makeActiveSession({
      reviewId: "22222222-2222-4222-8222-222222222222",
      mode: "unstaged",
    });
    const modeActiveSession = createDeferred<ActiveReviewSessionResponse>();
    const allActiveSession = createDeferred<ActiveReviewSessionResponse>();
    api = {
      getActiveReviewSession: vi.fn((mode?: string) =>
        mode === "unstaged" ? modeActiveSession.promise : allActiveSession.promise,
      ),
    } as unknown as BoundApi;

    queryClient.setQueryData(reviewQueries.activeSession(api, "unstaged").queryKey, { session });
    queryClient.setQueryData(reviewQueries.activeSession(api).queryKey, { session });
    const modeFetch = queryClient
      .fetchQuery(reviewQueries.activeSession(api, "unstaged"))
      .catch(() => undefined);
    const allFetch = queryClient
      .fetchQuery(reviewQueries.activeSession(api))
      .catch(() => undefined);
    await waitFor(() => expect(api.getActiveReviewSession).toHaveBeenCalledTimes(2));

    const { result } = renderHook(() => useReviewSessionCache(), {
      wrapper: makeWrapper(api, queryClient),
    });

    await act(async () => {
      await result.current.clearActiveSession("unstaged", session.reviewId);
    });

    await act(async () => {
      modeActiveSession.resolve({ session });
      allActiveSession.resolve({ session });
      await Promise.all([modeFetch, allFetch]);
    });

    expect(queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey)).toEqual(
      { session: null },
    );
    expect(queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
      session: null,
    });
  });
});

describe("review lifecycle start gating", () => {
  it("allows an explicit live resume without setup while preserving the default setup gate", async () => {
    const liveResume = vi.fn<UseReviewStartOptions["resume"]>().mockResolvedValue(ok(undefined));

    renderHook(() =>
      useReviewStart({
        configLoading: false,
        settingsLoading: false,
        isConfigured: false,
        allowResumeWithoutSetup: true,
        reviewId: "live-review",
        resume: liveResume,
      }),
    );

    await waitFor(() => expect(liveResume).toHaveBeenCalledWith("live-review"));

    const gatedResume = vi.fn<UseReviewStartOptions["resume"]>().mockResolvedValue(ok(undefined));
    const { result } = renderHook(() =>
      useReviewStart({
        configLoading: false,
        settingsLoading: false,
        isConfigured: false,
        reviewId: "new-review",
        resume: gatedResume,
      }),
    );

    expect(result.current.hasStarted).toBe(false);
    expect(gatedResume).not.toHaveBeenCalled();
  });
});

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

  it("exposes a generic stream failure as terminal and not running", async () => {
    const onComplete = vi.fn();
    const onStreamComplete = vi.fn();
    const api = createLifecycleApi(err({ code: "STREAM_ERROR", message: "network failed" }));
    const lifecycleQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
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
      { wrapper: makeWrapper(api, lifecycleQueryClient) },
    );

    await waitFor(() => expect(api.resumeReviewStream).toHaveBeenCalled());
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
    const api = createLifecycleApi(
      err({ code: ReviewErrorCode.CANCELLED, message: "Review was cancelled remotely." }),
    );
    const lifecycleQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
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
      { wrapper: makeWrapper(api, lifecycleQueryClient) },
    );

    await waitFor(() => expect(api.resumeReviewStream).toHaveBeenCalled());
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
    const api = {
      getSettings: vi.fn(async () => makeSettings()),
      cancelReviewSession: vi.fn(async () => ({ cancelled: true })),
      getReviewContext: vi.fn(),
      resumeReviewStream: vi.fn(),
    } as unknown as BoundApi;
    const lifecycleQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () =>
        useReviewLifecycleBase({
          configLoading: false,
          isConfigured: true,
          onComplete: vi.fn(),
        }),
      { wrapper: makeWrapper(api, lifecycleQueryClient) },
    );

    act(() => {
      result.current.start.setHasStarted(true);
    });
    await waitFor(() => expect(result.current.checks.loadingMessage).toBeNull());

    await act(async () => {
      await result.current.stream.cancel("local-cancel-review");
    });

    expect(api.cancelReviewSession).toHaveBeenCalledWith("local-cancel-review");
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
    const api = createLifecycleApi(err({ code, message }));
    const lifecycleQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
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
      { wrapper: makeWrapper(api, lifecycleQueryClient) },
    );

    await waitFor(() => expect(api.resumeReviewStream).toHaveBeenCalled());
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
