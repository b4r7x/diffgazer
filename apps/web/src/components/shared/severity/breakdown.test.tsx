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

  test("mutes zero counts and keeps the severity color on non-zero counts", () => {
    const counts: SeverityCounts = { blocker: 0, high: 0, medium: 2, low: 0, nit: 0 };
    render(<SeverityBreakdown counts={counts} />);

    // Sanctioned class assertion: the severity color class IS the visual contract
    // under test here — zero rows must not be painted in alarm colors. The row is
    // reached through its meter, the one element the severity name accessibly
    // identifies; the same text also appears inside the meter's value text.
    const countOf = (label: string) =>
      screen.getByRole("meter", { name: label }).parentElement?.lastElementChild;

    expect(countOf("BLOCKER")).toHaveTextContent("0");
    expect(countOf("BLOCKER")).not.toHaveClass("text-severity-blocker");
    expect(countOf("BLOCKER")).toHaveClass("text-muted-foreground");
    expect(countOf("MED")).toHaveTextContent("2");
    expect(countOf("MED")).toHaveClass("text-severity-medium");
  });
});
