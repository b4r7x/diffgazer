/** @vitest-environment jsdom */

import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveReviewSession, ActiveReviewSessionResponse } from "../../schemas/review/index.js";
import { createDeferred } from "../../testing/deferred.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import { reviewQueries } from "./queries/review.js";
import { useCreateReview, useReviewSessionCache } from "./review.js";

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

function setup(apiOverrides: Partial<BoundApi> = {}) {
  return createTestQueryWrapper({ api: apiOverrides });
}

describe("review active-session cache helpers", () => {
  let queryClient: QueryClient;
  let api: BoundApi;
  let Wrapper: ReturnType<typeof createTestQueryWrapper>["Wrapper"];

  beforeEach(() => {
    const harness = setup();
    queryClient = harness.queryClient;
    api = harness.api;
    Wrapper = harness.Wrapper;
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
      wrapper: Wrapper,
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
      wrapper: Wrapper,
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
      wrapper: Wrapper,
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
    const harness = setup({
      createReview: vi.fn(async () => ({ reviewId: unstaged.reviewId, session: unstaged })),
    });
    api = harness.api;

    const { result: createResult } = renderHook(() => useCreateReview(), {
      wrapper: harness.Wrapper,
    });

    act(() => {
      createResult.current.mutate({ mode: "unstaged" });
    });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));

    const { result: cacheResult } = renderHook(() => useReviewSessionCache(), {
      wrapper: harness.Wrapper,
    });

    expect(
      harness.queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey),
    ).toEqual({ session: unstaged });
    expect(harness.queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
      session: unstaged,
    });

    await act(async () => {
      await cacheResult.current.clearActiveSession("unstaged", unstaged.reviewId);
    });

    expect(
      harness.queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey),
    ).toEqual({ session: null });
    expect(harness.queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
      session: null,
    });
  });

  it("returns a stable cache helper object and clearActiveSession function", () => {
    const { result, rerender } = renderHook(() => useReviewSessionCache(), {
      wrapper: Wrapper,
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
    const harness = setup({
      getActiveReviewSession: vi.fn(() => activeSession.promise),
      createReview: vi.fn(async () => ({
        reviewId: createdSession.reviewId,
        session: createdSession,
      })),
    });
    api = harness.api;

    const olderFetch = harness.queryClient
      .fetchQuery(reviewQueries.activeSession(api, "unstaged"))
      .catch(() => undefined);
    await waitFor(() => expect(api.getActiveReviewSession).toHaveBeenCalledTimes(1));

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: harness.Wrapper,
    });

    act(() => {
      result.current.mutate({ mode: "unstaged" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      activeSession.resolve({ session: olderSession });
      await olderFetch;
    });

    expect(
      harness.queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey),
    ).toEqual({ session: createdSession });
    expect(harness.queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
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
    const harness = setup({
      getActiveReviewSession: vi.fn((mode?: string) =>
        mode === "unstaged" ? modeActiveSession.promise : allActiveSession.promise,
      ),
    });
    api = harness.api;

    harness.queryClient.setQueryData(reviewQueries.activeSession(api, "unstaged").queryKey, {
      session,
    });
    harness.queryClient.setQueryData(reviewQueries.activeSession(api).queryKey, { session });
    const modeFetch = harness.queryClient
      .fetchQuery(reviewQueries.activeSession(api, "unstaged"))
      .catch(() => undefined);
    const allFetch = harness.queryClient
      .fetchQuery(reviewQueries.activeSession(api))
      .catch(() => undefined);
    await waitFor(() => expect(api.getActiveReviewSession).toHaveBeenCalledTimes(2));

    const { result } = renderHook(() => useReviewSessionCache(), {
      wrapper: harness.Wrapper,
    });

    await act(async () => {
      await result.current.clearActiveSession("unstaged", session.reviewId);
    });

    await act(async () => {
      modeActiveSession.resolve({ session });
      allActiveSession.resolve({ session });
      await Promise.all([modeFetch, allFetch]);
    });

    expect(
      harness.queryClient.getQueryData(reviewQueries.activeSession(api, "unstaged").queryKey),
    ).toEqual({ session: null });
    expect(harness.queryClient.getQueryData(reviewQueries.activeSession(api).queryKey)).toEqual({
      session: null,
    });
  });
});
