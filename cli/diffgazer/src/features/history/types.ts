export type HistoryFocusZone = "search" | "timeline" | "runs" | "insights";

export type HistoryDetailState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "ready" };
