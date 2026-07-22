import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SeverityBreakdown } from "./breakdown";

describe("SeverityBreakdown", () => {
  test("renders every severity when only one has issues", () => {
    const counts: SeverityCounts = { blocker: 0, high: 1, medium: 0, low: 0, nit: 0 };
    render(<SeverityBreakdown counts={counts} />);

    const high = screen.getByRole("meter", { name: "HIGH" });
    expect(high).toHaveAttribute("aria-valuenow", "1");
    expect(high).toHaveAttribute("aria-valuetext", "HIGH: 1");

    for (const label of ["BLOCKER", "MED", "LOW", "NIT"]) {
      const meter = screen.getByRole("meter", { name: label });
      expect(meter).toHaveAttribute("aria-valuenow", "0");
      expect(meter).toHaveAttribute("aria-valuetext", `${label}: 0`);
    }
  });
});
