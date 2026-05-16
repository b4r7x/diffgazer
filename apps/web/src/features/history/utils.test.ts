import { describe, expect, it } from "vitest";
import type { SeverityPart } from "@diffgazer/core/review";
import { severityChipClass } from "./utils";

const SEVERITY_BASE: Record<SeverityPart["severity"], string> = {
  blocker: "text-tui-red",
  high: "text-tui-yellow",
  medium: "text-tui-blue",
  low: "text-tui-cyan",
  nit: "text-tui-muted",
};

describe("severityChipClass", () => {
  for (const severity of Object.keys(SEVERITY_BASE) as SeverityPart["severity"][]) {
    it(`returns the base color class for ${severity} severity`, () => {
      expect(severityChipClass(severity)).toContain(SEVERITY_BASE[severity]);
    });

    it(`returns the active-row inversion class for ${severity} severity`, () => {
      expect(severityChipClass(severity)).toContain("group-data-[active]:text-primary-foreground/85");
    });
  }
});
