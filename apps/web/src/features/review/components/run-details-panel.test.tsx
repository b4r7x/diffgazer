import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunDetailsPanel } from "./run-details-panel";

describe("RunDetailsPanel", () => {
  it("shows each lens outcome: dropped count beside issues for an incomplete answer, a bare count otherwise, failure text for a failed lens", () => {
    render(
      <RunDetailsPanel
        notices={[]}
        lensRows={[
          {
            lensId: "correctness",
            label: "Correctness",
            issueCount: 3,
            status: "success",
            droppedCandidateCount: 4,
          },
          { lensId: "security", label: "Security", issueCount: 3, status: "success" },
          {
            lensId: "performance",
            label: "Performance",
            issueCount: 0,
            status: "failed",
            errorCode: "STREAM_ERROR",
          },
        ]}
      />,
    );

    const table = screen.getByRole("table", { name: /issues by lens/i });
    // Every outcome is read off the lens that owns it, so swapping two rows' cells fails.
    const row = (lens: RegExp) => within(table).getByRole("row", { name: lens });
    // The incomplete answer keeps its issue count and owes the dropped fact beside it.
    expect(row(/Correctness/)).toHaveTextContent("3 · 4 dropped");
    // A lens that answered in full stays a bare count.
    expect(row(/^Security 3$/)).toBeInTheDocument();
    expect(row(/Performance/)).toHaveTextContent("failed [STREAM_ERROR]");
    // The header row plus one row per lens: a dropped row cannot pass silently.
    expect(within(table).getAllByRole("row")).toHaveLength(4);
  });
});
