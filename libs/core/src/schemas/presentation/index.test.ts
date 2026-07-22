import { describe, expect, expectTypeOf, it } from "vitest";
import {
  BadgeVariantSchema,
  type ContextInfo,
  type IssueTab,
  type LogEntryData,
  type LogTagType,
  type SeverityCounts,
  type Shortcut,
} from "./index.js";

describe("schemas/presentation public contracts", () => {
  it("keeps the presentation public types", () => {
    expectTypeOf<ContextInfo>().toEqualTypeOf<{
      trustedDir?: string;
      providerName?: string;
      providerModel?: string;
      lastRunId?: string;
      lastRunIssueCount?: number;
    }>();
    expectTypeOf<IssueTab>().toEqualTypeOf<"details" | "explain" | "trace" | "patch">();
    expectTypeOf<LogTagType>().toEqualTypeOf<
      "system" | "tool" | "lens" | "warning" | "error" | "agent" | "thinking"
    >();
    expectTypeOf<LogEntryData>().toEqualTypeOf<{
      id: string;
      timestamp: Date | string;
      tag: string;
      tagType?: LogTagType;
      message: string;
      isWarning?: boolean;
      source?: string;
      isError?: boolean;
    }>();
    expectTypeOf<SeverityCounts>().toEqualTypeOf<{
      blocker: number;
      high: number;
      medium: number;
      low: number;
      nit: number;
    }>();
    expectTypeOf<Shortcut>().toEqualTypeOf<{
      key: string;
      label: string;
      disabled?: boolean;
    }>();
  });

  it("accepts known badge variants and rejects unknown ones", () => {
    expect(BadgeVariantSchema.safeParse("info").success).toBe(true);
    expect(BadgeVariantSchema.safeParse("unknown").success).toBe(false);
  });
});
