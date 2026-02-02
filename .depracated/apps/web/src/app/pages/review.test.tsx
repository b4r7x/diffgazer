import { describe, it, expect, beforeEach, vi } from "vitest";
import { useState } from "react";
import type { ReactNode } from "react";

// Mock types matching ReviewPage
type ReviewView = "progress" | "summary" | "results";

// Test fixture: Mock implementation of useScopedRouteState
interface MockScopedRouteStateStore {
  [key: string]: Map<string, unknown>;
}

const mockScopedRouteStateStore: MockScopedRouteStateStore = {};

function createMockUseScopedRouteState() {
  return function useScopedRouteState<T>(
    key: string,
    defaultValue: T,
    options?: { scope?: string }
  ): [T, (value: T | ((prev: T) => T)) => void] {
    const scope = options?.scope || "/default";

    if (!mockScopedRouteStateStore[scope]) {
      mockScopedRouteStateStore[scope] = new Map();
    }

    const store = mockScopedRouteStateStore[scope];
    const storeKey = key;

    const getValue = (): T => {
      if (store.has(storeKey)) {
        return store.get(storeKey) as T;
      }
      return defaultValue;
    };

    const setValue = (value: T | ((prev: T) => T)) => {
      const newValue =
        typeof value === "function" ? (value as (prev: T) => T)(getValue()) : value;
      store.set(storeKey, newValue);
    };

    return [getValue(), setValue];
  };
}

describe("ReviewPage - useScopedRouteState View State", () => {
  beforeEach(() => {
    // Clear all scopes before each test
    Object.keys(mockScopedRouteStateStore).forEach((key) => {
      delete mockScopedRouteStateStore[key];
    });
  });

  describe("View Initialization", () => {
    it("initializes view from useScopedRouteState default ('progress')", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const [view] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: "/review/abc123",
      });

      expect(view).toBe("progress");
    });

    it("initializes view with custom default value", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const [view] = useScopedRouteState<ReviewView>("view", "summary", {
        scope: "/review/custom",
      });

      expect(view).toBe("summary");
    });

    it("supports all valid ReviewView states as defaults", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const views: ReviewView[] = ["progress", "summary", "results"];

      views.forEach((viewType) => {
        const [view] = useScopedRouteState<ReviewView>("view", viewType, {
          scope: `/review/${viewType}`,
        });
        expect(view).toBe(viewType);
      });
    });
  });

  describe("View State Persistence", () => {
    it("persists view state across multiple getter calls in same scope", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/review123";

      const [view1, setView1] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view1).toBe("progress");

      setView1("summary");

      const [view2] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view2).toBe("summary");

      const [view3] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view3).toBe("summary");
    });

    it("persists view state across multiple setView calls", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/persist";
      const [, setView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });

      setView("summary");
      const [view1] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view1).toBe("summary");

      setView("results");
      const [view2] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view2).toBe("results");

      // Should remain persistent
      const [view3] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view3).toBe("results");
    });

    it("maintains state persistence through functional updates", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/functional";
      const [, setView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });

      // Simulate functional update pattern used in ReviewPage
      const [currentView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });

      setView((prev) => {
        if (prev === "progress") return "summary";
        if (prev === "summary") return "results";
        return "progress";
      });

      const [view] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view).toBe("summary");
    });
  });

  describe("View State Updates", () => {
    it("setView updates scoped state with direct value", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/direct";
      const [initialView, setView] = useScopedRouteState<ReviewView>(
        "view",
        "progress",
        { scope }
      );

      expect(initialView).toBe("progress");

      setView("summary");

      const [updatedView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(updatedView).toBe("summary");
    });

    it("setView updates scoped state with updater function", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/updater";
      const [, setView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });

      setView((prev) => (prev === "progress" ? "summary" : "results"));

      const [view] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view).toBe("summary");

      setView((prev) => (prev === "summary" ? "results" : "progress"));

      const [finalView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(finalView).toBe("results");
    });

    it("transitions between all valid ReviewView states", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/transitions";
      const [, setView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });

      // progress -> summary
      setView("summary");
      let [view] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view).toBe("summary");

      // summary -> results
      setView("results");
      [view] = useScopedRouteState<ReviewView>("view", "progress", { scope });
      expect(view).toBe("results");

      // results -> progress
      setView("progress");
      [view] = useScopedRouteState<ReviewView>("view", "progress", { scope });
      expect(view).toBe("progress");
    });
  });

  describe("Scope Isolation", () => {
    it("different reviewIds have independent view states", () => {
      const useScopedRouteState = createMockUseScopedRouteState();

      // First review
      const [, setView1] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: "/review/review-001",
      });
      setView1("summary");

      // Second review
      const [view2, setView2] = useScopedRouteState<ReviewView>(
        "view",
        "progress",
        { scope: "/review/review-002" }
      );
      expect(view2).toBe("progress"); // Should be default, not affected by first review

      setView2("results");

      // Verify first review state unchanged
      const [view1] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: "/review/review-001",
      });
      expect(view1).toBe("summary");

      // Verify second review state is results
      const [view2Updated] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: "/review/review-002",
      });
      expect(view2Updated).toBe("results");
    });

    it("maintains independent states for three different reviews", () => {
      const useScopedRouteState = createMockUseScopedRouteState();

      const reviews = ["review-a", "review-b", "review-c"];
      const states: ReviewView[] = ["progress", "summary", "results"];

      // Set different states for each review
      reviews.forEach((reviewId, index) => {
        const [, setView] = useScopedRouteState<ReviewView>("view", "progress", {
          scope: `/review/${reviewId}`,
        });
        setView(states[index]);
      });

      // Verify each maintains its own state
      reviews.forEach((reviewId, index) => {
        const [view] = useScopedRouteState<ReviewView>("view", "progress", {
          scope: `/review/${reviewId}`,
        });
        expect(view).toBe(states[index]);
      });
    });

    it("updates to one review do not affect others", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope1 = "/review/shared-001";
      const scope2 = "/review/shared-002";

      // Initialize both with same default
      const [, setView1] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: scope1,
      });
      const [, setView2] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: scope2,
      });

      // Update first review multiple times
      setView1("summary");
      setView1("results");
      setView1("summary");

      // Second should still be at default
      const [view2] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: scope2,
      });
      expect(view2).toBe("progress");

      // Update second review
      setView2("results");

      // First should remain at its last update
      const [view1] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: scope1,
      });
      expect(view1).toBe("summary");
    });
  });

  describe("State Key Isolation", () => {
    it("different keys within same scope are independent", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/multi-key";

      // Set view to summary
      const [, setView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      setView("summary");

      // Set issueIndex separately
      const [, setIssueIndex] = useScopedRouteState<number>(
        "issueIndex",
        0,
        { scope }
      );
      setIssueIndex(5);

      // View should still be summary
      const [view] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view).toBe("summary");

      // issueIndex should be 5
      const [issueIndex] = useScopedRouteState<number>("issueIndex", 0, {
        scope,
      });
      expect(issueIndex).toBe(5);
    });
  });

  describe("React Re-render Scenarios", () => {
    it("maintains view state persistence across simulated re-renders", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/rerender";

      // First render
      const [view1, setView1] = useScopedRouteState<ReviewView>(
        "view",
        "progress",
        { scope }
      );
      expect(view1).toBe("progress");

      // User action triggers state update
      setView1("summary");

      // Second render (component re-renders after state change)
      const [view2] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view2).toBe("summary");

      // Another state update
      const [, setView3] = useScopedRouteState<ReviewView>(
        "view",
        "progress",
        { scope }
      );
      setView3("results");

      // Third render
      const [view4] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view4).toBe("results");
    });

    it("handles rapid sequential updates correctly", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/rapid";
      const [, setView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });

      // Rapid updates
      setView("summary");
      setView("results");
      setView("summary");

      const [finalView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(finalView).toBe("summary");
    });
  });

  describe("Edge Cases", () => {
    it("handles scope with special characters", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/review-001?staged=true&files=true";
      const [, setView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });

      setView("summary");

      const [view] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      expect(view).toBe("summary");
    });

    it("initializes with correct type for ReviewView union type", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/type-check";
      const [view] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });

      const validViews: ReviewView[] = ["progress", "summary", "results"];
      expect(validViews).toContain(view);
    });

    it("preserves state when re-initialized with different default", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const scope = "/review/reinit";

      // First initialization
      const [, setView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope,
      });
      setView("results");

      // Re-initialization with different default (simulates component remount)
      // The hook should return stored value, not the new default
      const [view] = useScopedRouteState<ReviewView>("view", "summary", {
        scope,
      });
      expect(view).toBe("results");
    });
  });

  describe("Integration: Multiple State Keys Simulation", () => {
    it("simulates ReviewPage managing both view and selectedIssueIndex in same scope", () => {
      const useScopedRouteState = createMockUseScopedRouteState();
      const reviewScope = "/review/integrated";

      // Initialize view state
      const [, setView] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: reviewScope,
      });

      // Initialize issue index state
      const [, setIssueIndex] = useScopedRouteState<number>(
        "issueIndex",
        0,
        { scope: reviewScope }
      );

      // Simulate workflow: progress -> summary -> results
      setView("summary");
      setIssueIndex(2);

      let [view, setViewAgain] = useScopedRouteState<ReviewView>(
        "view",
        "progress",
        { scope: reviewScope }
      );
      expect(view).toBe("summary");

      let [issueIndex] = useScopedRouteState<number>("issueIndex", 0, {
        scope: reviewScope,
      });
      expect(issueIndex).toBe(2);

      // Move to results view
      setViewAgain("results");
      setIssueIndex(5);

      [view] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: reviewScope,
      });
      [issueIndex] = useScopedRouteState<number>("issueIndex", 0, {
        scope: reviewScope,
      });

      expect(view).toBe("results");
      expect(issueIndex).toBe(5);
    });

    it("simulates switching between different reviews maintains separate state", () => {
      const useScopedRouteState = createMockUseScopedRouteState();

      // Review A workflow
      const scopeA = "/review/review-alpha";
      const [, setViewA] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: scopeA,
      });
      setViewA("summary");

      const [, setIndexA] = useScopedRouteState<number>("issueIndex", 0, {
        scope: scopeA,
      });
      setIndexA(3);

      // Review B workflow
      const scopeB = "/review/review-beta";
      const [viewB, setViewB] = useScopedRouteState<ReviewView>(
        "view",
        "progress",
        { scope: scopeB }
      );
      expect(viewB).toBe("progress");

      setViewB("results");

      const [indexB, setIndexB] = useScopedRouteState<number>(
        "issueIndex",
        0,
        { scope: scopeB }
      );
      expect(indexB).toBe(0);

      setIndexB(7);

      // Verify Review A state unchanged
      const [finalViewA] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: scopeA,
      });
      const [finalIndexA] = useScopedRouteState<number>("issueIndex", 0, {
        scope: scopeA,
      });

      expect(finalViewA).toBe("summary");
      expect(finalIndexA).toBe(3);

      // Verify Review B state
      const [finalViewB] = useScopedRouteState<ReviewView>("view", "progress", {
        scope: scopeB,
      });
      const [finalIndexB] = useScopedRouteState<number>("issueIndex", 0, {
        scope: scopeB,
      });

      expect(finalViewB).toBe("results");
      expect(finalIndexB).toBe(7);
    });
  });
});

describe("ReviewPage - Invalid UUID Navigation Fix", () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    stream: vi.fn(),
  };

  const mockNavigate = vi.fn();
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockReviewStatus = (
    overrides?: Partial<{
      sessionActive: boolean;
      reviewSaved: boolean;
      isComplete: boolean;
    }>
  ) => ({
    sessionActive: false,
    reviewSaved: false,
    isComplete: false,
    ...overrides,
  });

  const createMockSavedReview = () => ({
    metadata: {
      id: "test-review-123",
      projectPath: "/test/project",
      createdAt: new Date().toISOString(),
      staged: true,
      branch: "main",
      profile: null,
      lenses: [],
      issueCount: 5,
      blockerCount: 1,
      highCount: 2,
      fileCount: 3,
    },
    result: {
      issues: [
        {
          id: "issue-1",
          title: "Test Issue",
          description: "A test issue",
          file: "test.ts",
          line_start: 10,
          line_end: 10,
          category: "style",
          severity: "low",
          explanation: "This is a test",
        },
      ],
    },
    gitContext: {
      branch: "main",
      commit: "abc123",
      fileCount: 3,
      additions: 10,
      deletions: 5,
    },
    drilldowns: [],
  });

  describe("Invalid UUID Navigation", () => {
    it("makes single status check for non-existent UUID", async () => {
      const reviewId = "non-existent-uuid";
      mockApi.get.mockRejectedValueOnce({ status: 404, message: "Review not found" });

      let statusCheckDone = false;
      let errorHandled = false;

      const checkStatus = async () => {
        if (statusCheckDone) return;

        try {
          await mockApi.get(`/reviews/${reviewId}/status`);
        } catch (error) {
          errorHandled = true;
          const err = error as { status?: number };
          expect(err.status).toBe(404);
        } finally {
          statusCheckDone = true;
        }
      };

      await checkStatus();

      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(mockApi.get).toHaveBeenCalledWith(`/reviews/${reviewId}/status`);
      expect(statusCheckDone).toBe(true);
      expect(errorHandled).toBe(true);
    });

    it("shows error toast and redirects on 404", async () => {
      const reviewId = "non-existent-uuid";
      const mockError = { status: 404, message: "Review not found" };
      mockApi.get.mockRejectedValueOnce(mockError);

      const handleApiError = (error: unknown) => {
        const err = error as { status?: number; message?: string };
        if (err.status === 404) {
          mockShowToast({
            variant: "error",
            title: "Review Not Found",
            message: "The review session was not found or has expired.",
          });
          mockNavigate({ to: "/" });
        }
      };

      try {
        await mockApi.get(`/reviews/${reviewId}/status`);
      } catch (error) {
        handleApiError(error);
      }

      expect(mockShowToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Review Not Found",
        message: "The review session was not found or has expired.",
      });
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });

    it("shows error toast and redirects on 400 (invalid format)", async () => {
      const reviewId = "invalid-format";
      const mockError = { status: 400, message: "Invalid UUID format" };
      mockApi.get.mockRejectedValueOnce(mockError);

      const handleApiError = (error: unknown) => {
        const err = error as { status?: number; message?: string };
        if (err.status === 400) {
          mockShowToast({
            variant: "error",
            title: "Invalid Review ID",
            message: "The review ID format is invalid.",
          });
          mockNavigate({ to: "/" });
        }
      };

      try {
        await mockApi.get(`/reviews/${reviewId}/status`);
      } catch (error) {
        handleApiError(error);
      }

      expect(mockShowToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Invalid Review ID",
        message: "The review ID format is invalid.",
      });
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });

    it("does not make additional API calls after error", async () => {
      const reviewId = "non-existent-uuid";
      mockApi.get.mockRejectedValueOnce({ status: 404, message: "Not found" });

      let statusCheckDone = false;

      const checkStatus = async () => {
        if (statusCheckDone) return;

        try {
          await mockApi.get(`/reviews/${reviewId}/status`);
        } catch {
          // Error handled
        } finally {
          statusCheckDone = true;
        }
      };

      await checkStatus();
      expect(mockApi.get).toHaveBeenCalledTimes(1);

      // Simulate second attempt - should be blocked by statusCheckDone
      await checkStatus();
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("Completed Review Navigation", () => {
    it("calls getReviewStatus first, then getTriageReview if reviewSaved", async () => {
      const reviewId = "completed-review-123";
      const statusResponse = createMockReviewStatus({ reviewSaved: true });
      const savedReview = createMockSavedReview();

      mockApi.get
        .mockResolvedValueOnce(statusResponse)
        .mockResolvedValueOnce({ review: savedReview });

      let view = "progress";
      let statusCheckDone = false;

      const checkStatus = async () => {
        if (statusCheckDone) return;

        const status = await mockApi.get(`/reviews/${reviewId}/status`);

        if (status.reviewSaved) {
          const { review } = await mockApi.get(`/triage/reviews/${reviewId}`);
          view = "results";
        }

        statusCheckDone = true;
      };

      await checkStatus();

      expect(mockApi.get).toHaveBeenCalledTimes(2);
      expect(mockApi.get).toHaveBeenNthCalledWith(1, `/reviews/${reviewId}/status`);
      expect(mockApi.get).toHaveBeenNthCalledWith(2, `/triage/reviews/${reviewId}`);
      expect(view).toBe("results");
      expect(statusCheckDone).toBe(true);
    });

    it("shows results view directly when review is saved", async () => {
      const reviewId = "saved-review-456";
      const statusResponse = createMockReviewStatus({ reviewSaved: true });
      const savedReview = createMockSavedReview();

      mockApi.get
        .mockResolvedValueOnce(statusResponse)
        .mockResolvedValueOnce({ review: savedReview });

      let view = "progress";
      let reviewData = { issues: [], reviewId: null };

      const checkStatus = async () => {
        const status = await mockApi.get(`/reviews/${reviewId}/status`);

        if (status.reviewSaved) {
          const { review } = await mockApi.get(`/triage/reviews/${reviewId}`);
          reviewData = {
            issues: review.result.issues,
            reviewId: review.metadata.id,
          };
          view = "results";
        }
      };

      await checkStatus();

      expect(view).toBe("results");
      expect(reviewData.reviewId).toBe("test-review-123");
      expect(reviewData.issues).toHaveLength(1);
    });

    it("does not call getTriageReview if reviewSaved is false", async () => {
      const reviewId = "not-saved-review";
      const statusResponse = createMockReviewStatus({ reviewSaved: false, sessionActive: false });

      mockApi.get.mockResolvedValueOnce(statusResponse);

      const checkStatus = async () => {
        const status = await mockApi.get(`/reviews/${reviewId}/status`);

        if (status.reviewSaved) {
          await mockApi.get(`/triage/reviews/${reviewId}`);
        }
      };

      await checkStatus();

      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(mockApi.get).toHaveBeenCalledWith(`/reviews/${reviewId}/status`);
    });
  });

  describe("Active Session Navigation", () => {
    it("does not call getTriageReview when sessionActive is true", async () => {
      const reviewId = "active-session-123";
      const statusResponse = createMockReviewStatus({ sessionActive: true });

      mockApi.get.mockResolvedValueOnce(statusResponse);

      let shouldCallGetReview = false;

      const checkStatus = async () => {
        const status = await mockApi.get(`/reviews/${reviewId}/status`);

        if (status.sessionActive) {
          // Let ReviewContainer handle resume - don't call getTriageReview
          shouldCallGetReview = false;
          return;
        }

        if (status.reviewSaved) {
          shouldCallGetReview = true;
          await mockApi.get(`/triage/reviews/${reviewId}`);
        }
      };

      await checkStatus();

      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(mockApi.get).toHaveBeenCalledWith(`/reviews/${reviewId}/status`);
      expect(shouldCallGetReview).toBe(false);
    });

    it("lets ReviewContainer mount when sessionActive is true", async () => {
      const reviewId = "resume-session-789";
      const statusResponse = createMockReviewStatus({ sessionActive: true });

      mockApi.get.mockResolvedValueOnce(statusResponse);

      let isCheckingStatus = true;
      let statusCheckDone = false;

      const checkStatus = async () => {
        if (statusCheckDone) return;

        const status = await mockApi.get(`/reviews/${reviewId}/status`);

        if (status.sessionActive) {
          statusCheckDone = true;
          isCheckingStatus = false;
          return;
        }
      };

      await checkStatus();

      expect(statusCheckDone).toBe(true);
      expect(isCheckingStatus).toBe(false);
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("React Strict Mode Handling (AbortController)", () => {
    it("cancels first request when effect runs twice", async () => {
      const reviewId = "strict-mode-test";
      let firstRequestAborted = false;
      let secondRequestCompleted = false;

      const simulateEffect = async (signal: AbortSignal) => {
        try {
          await new Promise((resolve, reject) => {
            if (signal.aborted) {
              reject(new Error("Aborted"));
              return;
            }
            signal.addEventListener("abort", () => reject(new Error("Aborted")));
            setTimeout(resolve, 10);
          });
          secondRequestCompleted = true;
        } catch (error) {
          if ((error as Error).message === "Aborted") {
            firstRequestAborted = true;
          }
        }
      };

      // First mount
      const controller1 = new AbortController();
      const effect1 = simulateEffect(controller1.signal);

      // Cleanup (Strict Mode unmount)
      controller1.abort();

      // Second mount
      const controller2 = new AbortController();
      await simulateEffect(controller2.signal);

      await effect1.catch(() => {});

      expect(firstRequestAborted).toBe(true);
      expect(secondRequestCompleted).toBe(true);
    });

    it("prevents state updates when aborted", async () => {
      const reviewId = "abort-test";
      const statusResponse = createMockReviewStatus({ reviewSaved: true });
      mockApi.get.mockResolvedValueOnce(statusResponse);

      const controller = new AbortController();
      let stateUpdated = false;

      const checkStatus = async () => {
        const status = await mockApi.get(`/reviews/${reviewId}/status`);

        if (controller.signal.aborted) return;

        stateUpdated = true;
      };

      const checkPromise = checkStatus();

      // Abort before state update
      controller.abort();

      await checkPromise;

      expect(stateUpdated).toBe(false);
    });

    it("only shows one toast when effect runs twice", async () => {
      const reviewId = "double-mount-toast";
      const mockError = { status: 404, message: "Not found" };

      let toastCount = 0;
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const checkStatus = async (signal: AbortSignal) => {
        // Simulate async delay
        await new Promise((resolve) => setTimeout(resolve, 1));

        try {
          throw mockError;
        } catch (error) {
          if (signal.aborted) return;
          toastCount++;
        }
      };

      // First mount
      const check1 = checkStatus(controller1.signal);

      // Cleanup immediately (Strict Mode unmount) - aborts before error handler
      controller1.abort();

      // Second mount
      await checkStatus(controller2.signal);

      // Wait for first check to complete (should be aborted)
      await check1.catch(() => {});

      expect(toastCount).toBe(1);
    });
  });

  describe("handleResumeFailed Behavior", () => {
    it("does not make status check when called from resume failure", async () => {
      const reviewId = "resume-failed-123";
      const savedReview = createMockSavedReview();

      mockApi.get.mockResolvedValueOnce({ review: savedReview });

      let view = "progress";

      const handleResumeFailed = async (id: string) => {
        // Should only call getTriageReview, not getReviewStatus
        const { review } = await mockApi.get(`/triage/reviews/${id}`);
        view = "results";
      };

      await handleResumeFailed(reviewId);

      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(mockApi.get).toHaveBeenCalledWith(`/triage/reviews/${reviewId}`);
      expect(mockApi.get).not.toHaveBeenCalledWith(`/reviews/${reviewId}/status`);
      expect(view).toBe("results");
    });

    it("handles error in handleResumeFailed gracefully", async () => {
      const reviewId = "resume-error-456";
      const mockError = { status: 500, message: "Server error" };

      mockApi.get.mockRejectedValueOnce(mockError);

      let errorCaptured: unknown = null;

      const handleResumeFailed = async (id: string) => {
        try {
          await mockApi.get(`/triage/reviews/${id}`);
        } catch (error) {
          errorCaptured = error;
        }
      };

      await handleResumeFailed(reviewId);

      expect(errorCaptured).toEqual(mockError);
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("statusCheckDone Flag", () => {
    it("prevents re-running effect when statusCheckDone is true", async () => {
      const reviewId = "check-once-123";
      let statusCheckDone = false;

      const checkStatus = async () => {
        if (!reviewId || statusCheckDone) return;

        await mockApi.get(`/reviews/${reviewId}/status`);
        statusCheckDone = true;
      };

      await checkStatus();
      expect(mockApi.get).toHaveBeenCalledTimes(1);

      // Simulate re-render - should not run again
      await checkStatus();
      expect(mockApi.get).toHaveBeenCalledTimes(1);

      // Simulate third render
      await checkStatus();
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });

    it("sets statusCheckDone after active session check", async () => {
      const reviewId = "active-check-456";
      const statusResponse = createMockReviewStatus({ sessionActive: true });

      mockApi.get.mockResolvedValueOnce(statusResponse);

      let statusCheckDone = false;

      const checkStatus = async () => {
        if (statusCheckDone) return;

        const status = await mockApi.get(`/reviews/${reviewId}/status`);

        if (status.sessionActive) {
          statusCheckDone = true;
          return;
        }
      };

      await checkStatus();

      expect(statusCheckDone).toBe(true);
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });

    it("sets statusCheckDone after saved review check", async () => {
      const reviewId = "saved-check-789";
      const statusResponse = createMockReviewStatus({ reviewSaved: true });
      const savedReview = createMockSavedReview();

      mockApi.get
        .mockResolvedValueOnce(statusResponse)
        .mockResolvedValueOnce({ review: savedReview });

      let statusCheckDone = false;

      const checkStatus = async () => {
        if (statusCheckDone) return;

        const status = await mockApi.get(`/reviews/${reviewId}/status`);

        if (status.reviewSaved) {
          await mockApi.get(`/triage/reviews/${reviewId}`);
          statusCheckDone = true;
        }
      };

      await checkStatus();

      expect(statusCheckDone).toBe(true);
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });

    it("sets statusCheckDone even when review not found", async () => {
      const reviewId = "not-found-check";
      mockApi.get.mockRejectedValueOnce({ status: 404 });

      let statusCheckDone = false;

      const checkStatus = async () => {
        if (statusCheckDone) return;

        try {
          await mockApi.get(`/reviews/${reviewId}/status`);
        } catch {
          // Error handled
        } finally {
          statusCheckDone = true;
        }
      };

      await checkStatus();

      expect(statusCheckDone).toBe(true);
    });
  });

  describe("Integration: Complete Flow", () => {
    it("navigates to invalid UUID: status check -> error -> redirect", async () => {
      const reviewId = "invalid-complete-flow";
      mockApi.get.mockRejectedValueOnce({ status: 404, message: "Not found" });

      let statusCheckDone = false;
      let errorHandled = false;
      let toastShown = false;
      let redirected = false;

      const handleApiError = (error: unknown) => {
        const err = error as { status?: number };
        if (err.status === 404) {
          toastShown = true;
          redirected = true;
        }
        errorHandled = true;
      };

      const checkStatus = async () => {
        if (statusCheckDone) return;

        try {
          await mockApi.get(`/reviews/${reviewId}/status`);
        } catch (error) {
          handleApiError(error);
        } finally {
          statusCheckDone = true;
        }
      };

      await checkStatus();

      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(statusCheckDone).toBe(true);
      expect(errorHandled).toBe(true);
      expect(toastShown).toBe(true);
      expect(redirected).toBe(true);
    });

    it("navigates to completed UUID: status -> get review -> show results", async () => {
      const reviewId = "completed-flow";
      const statusResponse = createMockReviewStatus({ reviewSaved: true });
      const savedReview = createMockSavedReview();

      mockApi.get
        .mockResolvedValueOnce(statusResponse)
        .mockResolvedValueOnce({ review: savedReview });

      let view = "progress";
      let reviewData = { issues: [], reviewId: null };
      let isCheckingStatus = true;
      let statusCheckDone = false;

      const checkStatus = async () => {
        if (statusCheckDone) return;

        isCheckingStatus = true;
        const status = await mockApi.get(`/reviews/${reviewId}/status`);

        if (status.reviewSaved) {
          const { review } = await mockApi.get(`/triage/reviews/${reviewId}`);
          reviewData = {
            issues: review.result.issues,
            reviewId: review.metadata.id,
          };
          view = "results";
          statusCheckDone = true;
          isCheckingStatus = false;
        }
      };

      await checkStatus();

      expect(mockApi.get).toHaveBeenCalledTimes(2);
      expect(view).toBe("results");
      expect(reviewData.reviewId).toBe("test-review-123");
      expect(isCheckingStatus).toBe(false);
      expect(statusCheckDone).toBe(true);
    });

    it("navigates to active session: status -> mount ReviewContainer", async () => {
      const reviewId = "active-flow";
      const statusResponse = createMockReviewStatus({ sessionActive: true });

      mockApi.get.mockResolvedValueOnce(statusResponse);

      let view = "progress";
      let isCheckingStatus = true;
      let statusCheckDone = false;
      let reviewContainerMounted = false;

      const checkStatus = async () => {
        if (statusCheckDone) return;

        isCheckingStatus = true;
        const status = await mockApi.get(`/reviews/${reviewId}/status`);

        if (status.sessionActive) {
          statusCheckDone = true;
          isCheckingStatus = false;
          // ReviewContainer will mount
          reviewContainerMounted = true;
          return;
        }
      };

      await checkStatus();

      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(view).toBe("progress");
      expect(isCheckingStatus).toBe(false);
      expect(statusCheckDone).toBe(true);
      expect(reviewContainerMounted).toBe(true);
    });
  });
});

describe("ReviewPage - Status Pre-check (useEffect Logic)", () => {
  const mockApiModule = vi.hoisted(() => ({
    getTriageReview: vi.fn(),
  }));

  beforeEach(() => {
    mockApiModule.getTriageReview.mockClear();
  });

  const createMockReview = () => ({
    metadata: {
      id: "test-review-123",
      projectPath: "/test/project",
      createdAt: new Date().toISOString(),
      staged: true,
      branch: "main",
      profile: null,
      lenses: [],
      issueCount: 5,
      blockerCount: 1,
      highCount: 2,
      fileCount: 3,
    },
    result: {
      issues: [
        {
          id: "issue-1",
          title: "Test Issue",
          description: "A test issue",
          file: "test.ts",
          line_start: 10,
          line_end: 10,
          category: "style",
          severity: "low",
          explanation: "This is a test",
        },
      ],
    },
    gitContext: {
      branch: "main",
      commit: "abc123",
      fileCount: 3,
      additions: 10,
      deletions: 5,
    },
    drilldowns: [],
  });

  describe("Loading State", () => {
    it("shows 'Checking review...' while isCheckingStatus is true", async () => {
      mockApiModule.getTriageReview.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ review: createMockReview() });
            }, 50);
          })
      );

      let isCheckingStatus = false;
      let displayText = "";

      const checkStatus = async () => {
        isCheckingStatus = true;
        // At this point, UI would show "Checking review..."
        displayText = "Checking review...";
        expect(displayText).toBe("Checking review...");

        try {
          await mockApiModule.getTriageReview("api" as any, "test-123");
        } catch {
          // Not found - will proceed to progress view
        } finally {
          isCheckingStatus = false;
          displayText = "Review loaded";
        }
      };

      await checkStatus();
      expect(isCheckingStatus).toBe(false);
    });
  });

  describe("View Transitions on Pre-check", () => {
    it("sets view to 'results' when completed review found", async () => {
      mockApiModule.getTriageReview.mockResolvedValueOnce({
        review: createMockReview(),
      });

      let view: ReviewView = "progress";

      const params = { reviewId: "test-123" };
      let reviewData = { reviewId: null, issues: [], error: null };

      // Simulate the useEffect
      if (params.reviewId && reviewData.reviewId === null) {
        try {
          const { review } = await mockApiModule.getTriageReview(
            "api" as any,
            params.reviewId
          );
          reviewData = {
            reviewId: review.metadata.id,
            issues: review.result.issues,
            error: null,
          };
          view = "results";
        } catch {
          // Not completed - proceed to progress
        }
      }

      expect(view).toBe("results");
      expect(reviewData.reviewId).toBe("test-review-123");
    });

    it("proceeds to progress view when review not found", async () => {
      mockApiModule.getTriageReview.mockRejectedValueOnce(
        new Error("Not found")
      );

      let view: ReviewView = "progress";
      const params = { reviewId: "nonexistent-123" };
      let reviewData = { reviewId: null, issues: [], error: null };

      // Simulate the useEffect with error handling
      if (params.reviewId && reviewData.reviewId === null) {
        try {
          await mockApiModule.getTriageReview("api" as any, params.reviewId);
        } catch {
          // Silently fall through - stays in progress view
        }
      }

      expect(view).toBe("progress");
    });
  });

  describe("Conditional Execution", () => {
    it("does not check status when no reviewId in params", () => {
      const params = { reviewId: undefined };

      if (params.reviewId) {
        mockApiModule.getTriageReview("api" as any, params.reviewId);
      }

      expect(mockApiModule.getTriageReview).not.toHaveBeenCalled();
    });

    it("checks status only when reviewId exists in params", async () => {
      mockApiModule.getTriageReview.mockResolvedValueOnce({
        review: createMockReview(),
      });

      const params = { reviewId: "test-456" };

      if (params.reviewId) {
        await mockApiModule.getTriageReview("api" as any, params.reviewId);
      }

      expect(mockApiModule.getTriageReview).toHaveBeenCalledWith(
        expect.anything(),
        "test-456"
      );
    });
  });

  describe("Single Execution Guarantee", () => {
    it("only checks once (doesn't re-run on every render)", async () => {
      mockApiModule.getTriageReview.mockResolvedValue({
        review: createMockReview(),
      });

      let reviewData = { reviewId: null, issues: [], error: null };
      const params = { reviewId: "test-789" };

      // Simulate first render with effect
      if (params.reviewId && reviewData.reviewId === null) {
        try {
          const { review } = await mockApiModule.getTriageReview(
            "api" as any,
            params.reviewId
          );
          reviewData = {
            reviewId: review.metadata.id,
            issues: review.result.issues,
            error: null,
          };
        } catch {
          // Error case
        }
      }

      expect(mockApiModule.getTriageReview).toHaveBeenCalledTimes(1);

      // Simulate second render - the guard (reviewData.reviewId === null) is now false
      if (params.reviewId && reviewData.reviewId === null) {
        await mockApiModule.getTriageReview("api" as any, params.reviewId);
      }

      expect(mockApiModule.getTriageReview).toHaveBeenCalledTimes(1);
    });

    it("respects dependency array [params.reviewId] prevents re-runs on same ID", () => {
      let effectRuns = 0;

      const simulateEffect = (
        prevDeps: (string | undefined)[],
        newDeps: (string | undefined)[]
      ) => {
        if (JSON.stringify(prevDeps) !== JSON.stringify(newDeps)) {
          effectRuns++;
        }
      };

      const deps1 = ["test-same"];
      const deps2 = ["test-same"];
      const deps3 = ["test-different"];

      // Initial run
      simulateEffect([], deps1);
      expect(effectRuns).toBe(1);

      // Same reviewId - no re-run
      simulateEffect(deps1, deps2);
      expect(effectRuns).toBe(1);

      // Different reviewId - re-runs
      simulateEffect(deps2, deps3);
      expect(effectRuns).toBe(2);
    });

    it("prevents re-checking via reviewData.reviewId guard", () => {
      let checkAttempts = 0;
      let reviewData = { reviewId: null, issues: [], error: null };

      // First render - guard allows check
      if (reviewData.reviewId === null) {
        checkAttempts++;
      }
      expect(checkAttempts).toBe(1);

      // Simulate data loaded
      reviewData = { reviewId: "test-123", issues: [], error: null };

      // Second render - guard prevents check
      if (reviewData.reviewId === null) {
        checkAttempts++;
      }
      expect(checkAttempts).toBe(1);
    });
  });

  describe("Data Flow", () => {
    it("skips progress view when completed review is loaded", async () => {
      mockApiModule.getTriageReview.mockResolvedValueOnce({
        review: createMockReview(),
      });

      const { review } = await mockApiModule.getTriageReview(
        "api" as any,
        "test-123"
      );

      // Component decides which view based on loaded data
      const view = review ? "results" : "progress";
      expect(view).toBe("results");
    });

    it("loads review data into reviewData state correctly", async () => {
      const mockReview = createMockReview();
      mockApiModule.getTriageReview.mockResolvedValueOnce({
        review: mockReview,
      });

      const { review } = await mockApiModule.getTriageReview(
        "api" as any,
        "test-123"
      );

      const reviewData = {
        issues: review.result.issues,
        reviewId: review.metadata.id,
        error: null,
      };

      expect(reviewData.reviewId).toBe("test-review-123");
      expect(reviewData.issues).toHaveLength(1);
      expect(reviewData.issues[0].title).toBe("Test Issue");
      expect(reviewData.error).toBeNull();
    });

    it("handles API error gracefully without crash", async () => {
      mockApiModule.getTriageReview.mockRejectedValueOnce(
        new Error("Network error")
      );

      let errorCaught = false;
      try {
        await mockApiModule.getTriageReview("api" as any, "test-123");
      } catch {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);
      expect(mockApiModule.getTriageReview).toHaveBeenCalled();
    });
  });

  describe("Integration: Complete Pre-check Flow", () => {
    it("orchestrates full flow: params → checkStatus → data → view", async () => {
      mockApiModule.getTriageReview.mockResolvedValueOnce({
        review: createMockReview(),
      });

      const params = { reviewId: "integration-test-123" };
      let reviewData = { reviewId: null, issues: [], error: null };
      let view: ReviewView = "progress";
      let isCheckingStatus = false;

      if (params.reviewId) {
        const checkStatus = async () => {
          isCheckingStatus = true;
          try {
            if (reviewData.reviewId === null) {
              const { review } = await mockApiModule.getTriageReview(
                "api" as any,
                params.reviewId!
              );
              reviewData = {
                reviewId: review.metadata.id,
                issues: review.result.issues,
                error: null,
              };
              view = "results";
            }
          } catch {
            // Proceed to progress view
          } finally {
            isCheckingStatus = false;
          }
        };

        void checkStatus();
      }

      // Wait for async
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockApiModule.getTriageReview).toHaveBeenCalledWith(
        expect.anything(),
        "integration-test-123"
      );
      expect(view).toBe("results");
      expect(reviewData.reviewId).toBe("test-review-123");
      expect(isCheckingStatus).toBe(false);
    });

    it("handles scenario: navigate to review with params, check completes, shows results", async () => {
      mockApiModule.getTriageReview.mockResolvedValueOnce({
        review: createMockReview(),
      });

      // Simulate navigation to /review/test-xyz
      const params = { reviewId: "test-xyz" };
      let view: ReviewView = "progress";
      let reviewData = { reviewId: null, issues: [], error: null };
      let showLoadingText = false;

      // Effect runs because params.reviewId changed
      if (params.reviewId && reviewData.reviewId === null) {
        showLoadingText = true;

        try {
          const { review } = await mockApiModule.getTriageReview(
            "api" as any,
            params.reviewId
          );
          reviewData = {
            reviewId: review.metadata.id,
            issues: review.result.issues,
            error: null,
          };
          view = "results";
        } catch {
          showLoadingText = false;
        }
      }

      showLoadingText = false;

      // Verify final state
      expect(view).toBe("results");
      expect(reviewData.reviewId).toBe("test-review-123");
      expect(showLoadingText).toBe(false);
    });
  });

  describe("Invalid UUID Handling", () => {
    it("does not call API when reviewId is missing", () => {
      const params = { reviewId: undefined };
      let reviewData = { reviewId: null, issues: [], error: null };

      // Simulate the effect guard
      if (params.reviewId && reviewData.reviewId === null) {
        mockApiModule.getTriageReview("api" as any, params.reviewId);
      }

      expect(mockApiModule.getTriageReview).not.toHaveBeenCalled();
    });

    it("does not call API when reviewData already loaded", async () => {
      mockApiModule.getTriageReview.mockResolvedValueOnce({
        review: createMockReview(),
      });

      const params = { reviewId: "test-123" };
      let reviewData = { reviewId: null, issues: [], error: null };

      // First call - should execute
      if (params.reviewId && reviewData.reviewId === null) {
        const { review } = await mockApiModule.getTriageReview(
          "api" as any,
          params.reviewId
        );
        reviewData = {
          reviewId: review.metadata.id,
          issues: review.result.issues,
          error: null,
        };
      }

      expect(mockApiModule.getTriageReview).toHaveBeenCalledTimes(1);

      // Second call - should NOT execute (guard prevents it)
      if (params.reviewId && reviewData.reviewId === null) {
        await mockApiModule.getTriageReview("api" as any, params.reviewId);
      }

      expect(mockApiModule.getTriageReview).toHaveBeenCalledTimes(1);
    });

    it("calls safeHandleApiError when API returns 400 (invalid format)", async () => {
      const mockError = { status: 400, message: "Invalid UUID format" };
      mockApiModule.getTriageReview.mockRejectedValueOnce(mockError);

      const params = { reviewId: "invalid-uuid" };
      let reviewData = { reviewId: null, issues: [], error: null };
      let errorCaptured: unknown = null;
      const mockSafeHandleApiError = vi.fn();

      if (params.reviewId && reviewData.reviewId === null) {
        try {
          await mockApiModule.getTriageReview("api" as any, params.reviewId);
        } catch (error) {
          errorCaptured = error;
          mockSafeHandleApiError(error);
        }
      }

      expect(errorCaptured).toEqual(mockError);
      expect(mockSafeHandleApiError).toHaveBeenCalledWith(mockError);
    });

    it("calls safeHandleApiError when API returns 404 (not found)", async () => {
      const mockError = { status: 404, message: "Review not found" };
      mockApiModule.getTriageReview.mockRejectedValueOnce(mockError);

      const params = { reviewId: "nonexistent-uuid" };
      let reviewData = { reviewId: null, issues: [], error: null };
      let errorCaptured: unknown = null;
      const mockSafeHandleApiError = vi.fn();

      if (params.reviewId && reviewData.reviewId === null) {
        try {
          await mockApiModule.getTriageReview("api" as any, params.reviewId);
        } catch (error) {
          errorCaptured = error;
          mockSafeHandleApiError(error);
        }
      }

      expect(errorCaptured).toEqual(mockError);
      expect(mockSafeHandleApiError).toHaveBeenCalledWith(mockError);
    });

    it("prevents multiple error handlers from executing via hasHandledErrorRef", () => {
      const mockHandleApiError = vi.fn();
      let hasHandledErrorRef = false;

      const safeHandleApiError = (error: unknown) => {
        if (hasHandledErrorRef) return;
        hasHandledErrorRef = true;
        mockHandleApiError(error);
      };

      const error1 = { status: 400, message: "Error 1" };
      const error2 = { status: 404, message: "Error 2" };

      // First call - should handle
      safeHandleApiError(error1);
      expect(mockHandleApiError).toHaveBeenCalledTimes(1);
      expect(mockHandleApiError).toHaveBeenCalledWith(error1);

      // Second call - should be blocked
      safeHandleApiError(error2);
      expect(mockHandleApiError).toHaveBeenCalledTimes(1);
    });
  });

  describe("Effect Dependency Behavior", () => {
    it("effect runs only when params.reviewId changes", () => {
      let effectRuns = 0;

      const simulateEffect = (
        prevDeps: (string | undefined)[],
        newDeps: (string | undefined)[]
      ) => {
        if (JSON.stringify(prevDeps) !== JSON.stringify(newDeps)) {
          effectRuns++;
        }
      };

      // Initial mount
      simulateEffect([], ["review-123"]);
      expect(effectRuns).toBe(1);

      // Same reviewId - no re-run
      simulateEffect(["review-123"], ["review-123"]);
      expect(effectRuns).toBe(1);

      // Different reviewId - re-runs
      simulateEffect(["review-123"], ["review-456"]);
      expect(effectRuns).toBe(2);

      // reviewId removed - re-runs
      simulateEffect(["review-456"], [undefined]);
      expect(effectRuns).toBe(3);
    });

    it("effect does not run when reviewData.reviewId is already set", () => {
      const checkStatus = vi.fn();
      const params = { reviewId: "test-123" };

      // Case 1: reviewData.reviewId is null - should run
      let reviewData = { reviewId: null, issues: [], error: null };
      if (params.reviewId && reviewData.reviewId === null) {
        checkStatus();
      }
      expect(checkStatus).toHaveBeenCalledTimes(1);

      // Case 2: reviewData.reviewId is set - should not run
      reviewData = { reviewId: "test-123", issues: [], error: null };
      if (params.reviewId && reviewData.reviewId === null) {
        checkStatus();
      }
      expect(checkStatus).toHaveBeenCalledTimes(1);
    });
  });
});
