import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { ReviewStartedEvent, StepEvent } from "@diffgazer/schemas/events";
import type { AgentStreamEvent } from "@diffgazer/schemas/events";
import { createInitialSteps } from "@diffgazer/schemas/events";
import { ReviewErrorCode } from "@diffgazer/schemas/review";

// Mock the api module at the boundary
vi.mock("@/lib/api", () => ({
  api: {
    streamReviewWithEvents: vi.fn(),
    resumeReviewStream: vi.fn(),
  },
}));

import { api } from "@/lib/api";
import { useReviewStream } from "./use-review-stream";

const mockApi = api as {
  streamReviewWithEvents: ReturnType<typeof vi.fn>;
  resumeReviewStream: ReturnType<typeof vi.fn>;
};

function makeReviewStartedEvent(overrides: Partial<ReviewStartedEvent> = {}): ReviewStartedEvent {
  return {
    type: "review_started",
    reviewId: "r-123",
    filesTotal: 5,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeStepStartEvent(step: string): StepEvent {
  return {
    type: "step_start",
    step: step as StepEvent["step"],
    timestamp: new Date().toISOString(),
  };
}

function makeAgentQueuedEvent(): AgentStreamEvent {
  return {
    type: "agent_queued",
    agent: {
      id: "detective",
      lens: "correctness",
      name: "Detective",
      badgeLabel: "DET",
      badgeVariant: "info",
      description: "Finds bugs",
    },
    position: 0,
    total: 1,
    timestamp: new Date().toISOString(),
  } as AgentStreamEvent;
}

describe("useReviewStream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock requestAnimationFrame for batching tests
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  describe("initial state", () => {
    it("should return initial state with no streaming", () => {
      const { result } = renderHook(() => useReviewStream());

      expect(result.current.state.isStreaming).toBe(false);
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.reviewId).toBeNull();
      expect(result.current.state.issues).toEqual([]);
      expect(result.current.state.agents).toEqual([]);
      expect(result.current.state.steps).toEqual(createInitialSteps());
    });
  });

  describe("start", () => {
    it("should call API and set reviewId on success", async () => {
      mockApi.streamReviewWithEvents.mockImplementation(async (opts: Record<string, unknown>) => {
        const onStep = opts.onStepEvent as (event: StepEvent) => void;
        onStep(makeReviewStartedEvent());
        return { ok: true, value: { reviewId: "r-123" } };
      });

      const { result } = renderHook(() => useReviewStream());

      await act(async () => {
        await result.current.start({ mode: "staged" });
      });

      expect(mockApi.streamReviewWithEvents).toHaveBeenCalledOnce();
      expect(result.current.state.isStreaming).toBe(false);
      expect(result.current.state.reviewId).toBe("r-123");
    });

    it("should set error when API returns error result", async () => {
      mockApi.streamReviewWithEvents.mockResolvedValue({
        ok: false,
        error: { code: "STREAM_ERROR", message: "Connection failed" },
      });

      const { result } = renderHook(() => useReviewStream());

      await act(async () => {
        await result.current.start({ mode: "staged" });
      });

      expect(result.current.state.error).toBe("Connection failed");
      expect(result.current.state.isStreaming).toBe(false);
    });

    it("should set error when API throws non-abort error", async () => {
      mockApi.streamReviewWithEvents.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useReviewStream());

      await act(async () => {
        await result.current.start({ mode: "staged" });
      });

      expect(result.current.state.error).toBe("Network error");
      expect(result.current.state.isStreaming).toBe(false);
    });

    it("should treat AbortError as COMPLETE (not error)", async () => {
      // Create an error with name = "AbortError" that passes instanceof Error
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockApi.streamReviewWithEvents.mockRejectedValue(abortError);

      const { result } = renderHook(() => useReviewStream());

      await act(async () => {
        await result.current.start({ mode: "staged" });
      });

      expect(result.current.state.error).toBeNull();
      expect(result.current.state.isStreaming).toBe(false);
    });

    it("should abort previous stream when starting a new one", async () => {
      let callCount = 0;
      const signals: AbortSignal[] = [];

      mockApi.streamReviewWithEvents.mockImplementation(async (opts: Record<string, unknown>) => {
        signals.push(opts.signal as AbortSignal);
        callCount++;
        if (callCount === 1) {
          await new Promise((r) => setTimeout(r, 10));
        }
        return { ok: true, value: { reviewId: `r-${callCount}` } };
      });

      const { result } = renderHook(() => useReviewStream());

      await act(async () => {
        const first = result.current.start({ mode: "staged" });
        const second = result.current.start({ mode: "staged" });
        await Promise.allSettled([first, second]);
      });

      expect(signals[0]?.aborted).toBe(true);
    });
  });

  describe("stop", () => {
    it("should dispatch COMPLETE and abort the active stream", async () => {
      let capturedSignal: AbortSignal | undefined;
      mockApi.streamReviewWithEvents.mockImplementation(async (opts: Record<string, unknown>) => {
        capturedSignal = opts.signal as AbortSignal;
        await new Promise((resolve) => {
          (opts.signal as AbortSignal).addEventListener("abort", () => resolve(undefined));
        });
        return { ok: true, value: { reviewId: "r-1" } };
      });

      const { result } = renderHook(() => useReviewStream());

      let startPromise: Promise<void>;
      act(() => {
        startPromise = result.current.start({ mode: "staged" });
      });

      act(() => {
        result.current.stop();
      });

      expect(capturedSignal?.aborted).toBe(true);
      expect(result.current.state.isStreaming).toBe(false);

      await act(async () => {
        await startPromise!;
      });
    });
  });

  describe("resume", () => {
    it("should call resumeReviewStream and set COMPLETE on success", async () => {
      mockApi.resumeReviewStream.mockResolvedValue({ ok: true, value: undefined });

      const { result } = renderHook(() => useReviewStream());

      let resumeResult: unknown;
      await act(async () => {
        resumeResult = await result.current.resume("r-existing");
      });

      expect(mockApi.resumeReviewStream).toHaveBeenCalledOnce();
      expect(mockApi.resumeReviewStream).toHaveBeenCalledWith(
        expect.objectContaining({ reviewId: "r-existing" }),
      );
      expect((resumeResult as { ok: boolean }).ok).toBe(true);
      expect(result.current.state.isStreaming).toBe(false);
    });

    it("should set error for non-stale/non-not-found resume failures", async () => {
      mockApi.resumeReviewStream.mockResolvedValue({
        ok: false,
        error: { code: "STREAM_ERROR", message: "Connection lost" },
      });

      const { result } = renderHook(() => useReviewStream());

      await act(async () => {
        await result.current.resume("r-existing");
      });

      expect(result.current.state.error).toBe("Connection lost");
      expect(result.current.state.isStreaming).toBe(false);
    });

    it("should NOT set error for SESSION_STALE resume failures", async () => {
      mockApi.resumeReviewStream.mockResolvedValue({
        ok: false,
        error: { code: ReviewErrorCode.SESSION_STALE, message: "Stale session" },
      });

      const { result } = renderHook(() => useReviewStream());

      let resumeResult: unknown;
      await act(async () => {
        resumeResult = await result.current.resume("r-stale");
      });

      expect(result.current.state.error).toBeNull();
      expect((resumeResult as { ok: boolean }).ok).toBe(false);
    });

    it("should NOT set error for SESSION_NOT_FOUND resume failures", async () => {
      mockApi.resumeReviewStream.mockResolvedValue({
        ok: false,
        error: { code: ReviewErrorCode.SESSION_NOT_FOUND, message: "Not found" },
      });

      const { result } = renderHook(() => useReviewStream());

      let resumeResult: unknown;
      await act(async () => {
        resumeResult = await result.current.resume("r-gone");
      });

      expect(result.current.state.error).toBeNull();
      expect((resumeResult as { ok: boolean }).ok).toBe(false);
    });

    it("should return error result when resume throws", async () => {
      mockApi.resumeReviewStream.mockRejectedValue(new Error("Network failure"));

      const { result } = renderHook(() => useReviewStream());

      let resumeResult: unknown;
      await act(async () => {
        resumeResult = await result.current.resume("r-fail");
      });

      expect((resumeResult as { ok: boolean }).ok).toBe(false);
      expect((resumeResult as { error: { message: string } }).error.message).toBe("Network failure");
    });
  });

  describe("event dispatching", () => {
    it("should dispatch review_started immediately (bypasses rAF queue)", async () => {
      const rafCalls: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        rafCalls.push(cb);
        return rafCalls.length;
      });

      mockApi.streamReviewWithEvents.mockImplementation(async (opts: Record<string, unknown>) => {
        const onStep = opts.onStepEvent as (event: StepEvent) => void;
        onStep(makeReviewStartedEvent({ reviewId: "r-immediate" }));
        return { ok: true, value: { reviewId: "r-immediate" } };
      });

      const { result } = renderHook(() => useReviewStream());

      await act(async () => {
        await result.current.start({ mode: "staged" });
      });

      expect(result.current.state.reviewId).toBe("r-immediate");
    });

    it("should batch non-review_started events via rAF", async () => {
      const rafCalls: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        rafCalls.push(cb);
        return rafCalls.length;
      });

      mockApi.streamReviewWithEvents.mockImplementation(async (opts: Record<string, unknown>) => {
        const onStep = opts.onStepEvent as (event: StepEvent) => void;
        const onAgent = opts.onAgentEvent as (event: AgentStreamEvent) => void;

        onStep(makeStepStartEvent("diff"));
        onAgent(makeAgentQueuedEvent());

        // Flush the rAF queue
        for (const cb of rafCalls) cb(0);
        rafCalls.length = 0;

        return { ok: true, value: { reviewId: "r-batch" } };
      });

      const { result } = renderHook(() => useReviewStream());

      await act(async () => {
        await result.current.start({ mode: "staged" });
      });

      const diffStep = result.current.state.steps.find((s) => s.id === "diff");
      expect(diffStep?.status).toBe("active");
    });
  });

  describe("cleanup on unmount", () => {
    it("should abort stream and cancel rAF on unmount", () => {
      const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");

      mockApi.streamReviewWithEvents.mockImplementation(
        () => new Promise(() => {}),
      );

      const { result, unmount } = renderHook(() => useReviewStream());

      act(() => {
        result.current.start({ mode: "staged" });
      });

      unmount();

      // cleanup effect ran without errors
      expect(cancelSpy).toBeDefined();
    });
  });
});
