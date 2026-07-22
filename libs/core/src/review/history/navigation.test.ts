import { describe, expect, it, vi } from "vitest";
import { makeReviewMetadata } from "../../testing/factories.js";
import {
  buildTimelineItems,
  deriveHistoryDetailState,
  filterReviewsForHistory,
  getEmptyRunsMessage,
  HISTORY_SECTION_ALL_ID,
  matchesHistoryQuery,
  resolveSelectedDateId,
  resolveSelectedId,
} from "../history.js";

function inNewYork(run: () => void): void {
  const originalTimeZone = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    run();
  } finally {
    if (originalTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimeZone;
    }
  }
}

describe("deriveHistoryDetailState", () => {
  it("projects loading, error with retry, and ready query states", () => {
    const refetch = vi.fn();

    expect(deriveHistoryDetailState({ isLoading: true, error: null, refetch })).toEqual({
      status: "loading",
    });

    const errorState = deriveHistoryDetailState({
      isLoading: false,
      error: new Error("disk unreadable"),
      refetch,
    });
    expect(errorState).toMatchObject({ status: "error", message: "disk unreadable" });
    if (errorState.status === "error") errorState.retry();
    expect(refetch).toHaveBeenCalledOnce();

    expect(deriveHistoryDetailState({ isLoading: false, error: null, refetch })).toEqual({
      status: "ready",
    });
  });
});

describe("filterReviewsForHistory", () => {
  it("returns all reviews when the all-section is selected and there is no query", () => {
    const reviews = [
      makeReviewMetadata({ id: "a", createdAt: "2026-02-09T08:00:00.000Z" }),
      makeReviewMetadata({ id: "b", createdAt: "2026-02-08T08:00:00.000Z" }),
    ];
    expect(filterReviewsForHistory(reviews, HISTORY_SECTION_ALL_ID, "")).toEqual(reviews);
  });

  it("restricts to a date section by date key", () => {
    const reviews = [
      makeReviewMetadata({ id: "a", createdAt: "2026-02-09T08:00:00.000Z" }),
      makeReviewMetadata({ id: "b", createdAt: "2026-02-08T08:00:00.000Z" }),
    ];
    const filtered = filterReviewsForHistory(reviews, "2026-02-09", "");
    expect(filtered.map((r) => r.id)).toEqual(["a"]);
  });

  it("applies the search query within the selected section", () => {
    const reviews = [
      makeReviewMetadata({
        id: "a",
        branch: "feature/login",
        createdAt: "2026-02-09T08:00:00.000Z",
      }),
      makeReviewMetadata({ id: "b", branch: "main", createdAt: "2026-02-09T09:00:00.000Z" }),
    ];
    const filtered = filterReviewsForHistory(reviews, HISTORY_SECTION_ALL_ID, "feature");
    expect(filtered.map((r) => r.id)).toEqual(["a"]);
  });

  it("keeps adaptive id search stable when a colliding peer is in another date section", () => {
    const reviews = [
      makeReviewMetadata({
        id: "abcdef00-0000-4000-8000-000000000000",
        createdAt: "2026-02-09T08:00:00.000Z",
      }),
      makeReviewMetadata({
        id: "abcdef00-1000-4000-8000-000000000000",
        createdAt: "2026-02-08T08:00:00.000Z",
      }),
    ];

    expect(filterReviewsForHistory(reviews, "2026-02-09", "#abcdef00-0")).toEqual([reviews[0]]);
    expect(filterReviewsForHistory(reviews, "2026-02-09", "#abcdef00-1")).toEqual([]);
  });
});

describe("matchesHistoryQuery", () => {
  it("matches by full id, short id, branch text, or project path", () => {
    const r = makeReviewMetadata({
      id: "abcdef00-0000-4000-8000-000000000000",
      branch: "feature/login",
      projectPath: "/home/user/repo",
    });

    expect(matchesHistoryQuery(r, "abcdef")).toBe(true);
    expect(matchesHistoryQuery(r, "#abcdef00")).toBe(true);
    expect(matchesHistoryQuery(r, "feature")).toBe(true);
    expect(matchesHistoryQuery(r, "repo")).toBe(true);
    expect(matchesHistoryQuery(r, "nothing")).toBe(false);
  });

  it("uses the adaptive display id to disambiguate colliding loaded runs", () => {
    const reviews = [
      makeReviewMetadata({ id: "abcdef00-0000-4000-8000-000000000000" }),
      makeReviewMetadata({ id: "abcdef00-1000-4000-8000-000000000000" }),
    ];
    const peerIds = reviews.map((review) => review.id);
    const [firstReview, secondReview] = reviews;
    if (!firstReview || !secondReview) throw new Error("Expected collision fixtures");

    expect(matchesHistoryQuery(firstReview, "#abcdef00-0", peerIds)).toBe(true);
    expect(matchesHistoryQuery(secondReview, "#abcdef00-0", peerIds)).toBe(false);
    expect(
      filterReviewsForHistory(reviews, HISTORY_SECTION_ALL_ID, secondReview.id).map(
        (review) => review.id,
      ),
    ).toEqual([secondReview.id]);
  });

  it("uses staged label when mode is staged", () => {
    const r = makeReviewMetadata({ mode: "staged" });
    expect(matchesHistoryQuery(r, "staged")).toBe(true);
  });
});

describe("buildTimelineItems", () => {
  it("returns only the all-section when there are no reviews", () => {
    const items = buildTimelineItems([]);
    expect(items).toEqual([{ id: HISTORY_SECTION_ALL_ID, label: "All", count: 0 }]);
  });

  it("prepends the all-section followed by date sections in descending order", () => {
    const items = buildTimelineItems([
      makeReviewMetadata({ id: "a", createdAt: "2026-02-08T08:00:00.000Z" }),
      makeReviewMetadata({ id: "b", createdAt: "2026-02-09T08:00:00.000Z" }),
    ]);
    expect(items[0]?.id).toBe(HISTORY_SECTION_ALL_ID);
    expect(items[0]?.count).toBe(2);
    expect(items[1]?.count).toBe(1);
    expect(items[2]?.count).toBe(1);
  });

  it("labels date groups from the same date key used for grouping in TZ-sensitive runs", () => {
    inNewYork(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));

      try {
        const items = buildTimelineItems([
          makeReviewMetadata({ id: "a", createdAt: "2026-07-04T03:30:00.000Z" }),
          makeReviewMetadata({ id: "b", createdAt: "2026-07-04T01:30:00.000Z" }),
        ]);

        expect(items[1]).toMatchObject({ id: "2026-07-03", label: "Jul 3", count: 2 });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe("History local calendar sections", () => {
  it("groups, labels, and filters timestamps on opposite sides of local midnight", () => {
    inNewYork(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-04T16:00:00.000Z"));

      try {
        const afterMidnight = makeReviewMetadata({
          id: "after-midnight",
          createdAt: "2026-07-04T04:30:00.000Z",
        });
        const beforeMidnight = makeReviewMetadata({
          id: "before-midnight",
          createdAt: "2026-07-04T03:30:00.000Z",
        });
        const reviews = [afterMidnight, beforeMidnight];

        expect(buildTimelineItems(reviews)).toEqual([
          { id: HISTORY_SECTION_ALL_ID, label: "All", count: 2 },
          { id: "2026-07-04", label: "Today", count: 1 },
          { id: "2026-07-03", label: "Yesterday", count: 1 },
        ]);
        expect(
          filterReviewsForHistory(reviews, "2026-07-03", "").map((review) => review.id),
        ).toEqual(["before-midnight"]);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("uses local DST date keys while preserving the reviews' UTC sort order", () => {
    inNewYork(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-10T16:00:00.000Z"));

      try {
        const reviews = [
          makeReviewMetadata({ id: "newest", createdAt: "2026-03-08T07:30:00.000Z" }),
          makeReviewMetadata({ id: "middle", createdAt: "2026-03-08T05:30:00.000Z" }),
          makeReviewMetadata({ id: "oldest", createdAt: "2026-03-08T04:30:00.000Z" }),
        ];

        expect(buildTimelineItems(reviews)).toEqual([
          { id: HISTORY_SECTION_ALL_ID, label: "All", count: 3 },
          { id: "2026-03-08", label: "Mar 8", count: 2 },
          { id: "2026-03-07", label: "Mar 7", count: 1 },
        ]);
        expect(
          filterReviewsForHistory(reviews, "2026-03-08", "").map((review) => review.id),
        ).toEqual(["newest", "middle"]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe("resolveSelectedDateId + resolveSelectedId", () => {
  it("returns the current date id when present, else falls back to the first", () => {
    const timeline = [{ id: HISTORY_SECTION_ALL_ID }, { id: "2026-02-09" }];
    expect(resolveSelectedDateId("2026-02-09", timeline)).toBe("2026-02-09");
    expect(resolveSelectedDateId("missing", timeline)).toBe(HISTORY_SECTION_ALL_ID);
    expect(resolveSelectedDateId("missing", [])).toBe(HISTORY_SECTION_ALL_ID);
  });

  it("returns the current run id when present, else falls back to the first", () => {
    const runs = [{ id: "run-a" }, { id: "run-b" }];
    expect(resolveSelectedId("run-b", runs)).toBe("run-b");
    expect(resolveSelectedId("missing", runs)).toBe("run-a");
    expect(resolveSelectedId("missing", [])).toBeNull();
    expect(resolveSelectedId(null, runs)).toBe("run-a");
  });
});

describe("getEmptyRunsMessage", () => {
  it("messages each empty case with distinct copy", () => {
    expect(getEmptyRunsMessage(false, false, HISTORY_SECTION_ALL_ID)).toBe("No runs yet");
    expect(getEmptyRunsMessage(true, true, HISTORY_SECTION_ALL_ID)).toBe(
      "No runs match this search",
    );
    expect(getEmptyRunsMessage(true, false, HISTORY_SECTION_ALL_ID)).toBe("No runs available");
    expect(getEmptyRunsMessage(true, false, "2026-02-09")).toBe("No runs for this date");
  });
});
