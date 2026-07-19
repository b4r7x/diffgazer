import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SeverityBreakdown } from "./breakdown";

describe("SeverityBreakdown", () => {
  test("renders every severity when only one has issues", () => {
    const counts: SeverityCounts = { blocker: 0, high: 1, medium: 0, low: 0, nit: 0 };
    render(<SeverityBreakdown counts={counts} />);

    for (const label of ["BLOCKER", "HIGH", "MED", "LOW", "NIT"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
