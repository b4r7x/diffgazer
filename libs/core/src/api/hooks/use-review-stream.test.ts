/**
 * @vitest-environment jsdom
 */
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoundApi } from "../bound.js";
import { ApiProvider } from "./context.js";
import { useReviewStream } from "./use-review-stream.js";
import type { Result } from "@diffgazer/core/result";
import { ok } from "@diffgazer/core/result";
import type { StreamReviewError } from "@diffgazer/core/review";

function createApi(overrides: Partial<BoundApi> = {}): BoundApi {
  return {
    resumeReviewStream: vi.fn(),
    streamReviewWithEvents: vi.fn(),
    ...overrides,
  } as unknown as BoundApi;
}

function createWrapper(api: BoundApi) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ApiProvider, { value: api }, children);
  };
}

describe("useReviewStream", () => {
  it("exposes a resumed review id before the stream returns", async () => {
    let resolveResume: (result: Result<void, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockReturnValue(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>>;
    act(() => {
      resumePromise = result.current.resume("active-review");
    });

    await waitFor(() => expect(result.current.state.reviewId).toBe("active-review"));
    expect(result.current.state.isStreaming).toBe(true);

    await act(async () => {
      resolveResume(ok(undefined));
      await resumePromise;
    });

    expect(resumeReviewStream).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: "active-review" }),
    );
  });
});
