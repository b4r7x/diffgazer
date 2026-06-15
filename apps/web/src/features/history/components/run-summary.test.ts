import type { SeverityPart } from "@diffgazer/core/review";
import { describe, expect, it } from "vitest";
import { severityChipClass } from "./run-summary";

const SEVERITY_BASE: Record<SeverityPart["severity"], string> = {
  blocker: "text-error-text",
  high: "text-warning-text",
  medium: "text-info-text",
  low: "text-info-text",
  nit: "text-muted-foreground",
};

describe("severityChipClass", () => {
  for (const severity of Object.keys(SEVERITY_BASE) as SeverityPart["severity"][]) {
    it(`returns the base color class for ${severity} severity`, () => {
      expect(severityChipClass(severity)).toContain(SEVERITY_BASE[severity]);
    });

    it(`returns the active-row inversion class for ${severity} severity`, () => {
      expect(severityChipClass(severity)).toContain(
        "group-data-[highlighted]:text-primary-foreground/85",
      );
    });
  }
});
