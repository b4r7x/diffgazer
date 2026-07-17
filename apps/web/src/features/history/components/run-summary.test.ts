import { makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { render, screen } from "@testing-library/react";
import { createElement, Fragment } from "react";
import { describe, expect, it } from "vitest";
import { getRunSummary } from "./run-summary";

describe("getRunSummary", () => {
  it("renders partial analysis instead of a pass for a zero-issue failed-lens run", () => {
    render(
      createElement(
        Fragment,
        null,
        getRunSummary(makeReviewMetadata({ issueCount: 0, failedLensCount: 1 })),
      ),
    );

    expect(
      screen.getByText("Partial analysis: 1 lens failed; no issues found."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Passed with no issues.")).not.toBeInTheDocument();
  });
});
