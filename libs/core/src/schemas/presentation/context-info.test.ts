import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";
import { buildHomeContextInfo } from "./context-info.js";
import {
  BadgeVariantSchema,
  type ContextInfo,
  type IssueTab,
  type LogEntryData,
  type LogTagType,
  type SeverityCounts,
  type Shortcut,
} from "./index.js";

function transpilePresentationModule(fileName: string): string {
  return ts.transpileModule(readFileSync(new URL(fileName, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  }).outputText;
}

describe("buildHomeContextInfo", () => {
  it("maps provider, model, and the most recent review summary", () => {
    const context = buildHomeContextInfo(
      { provider: "openrouter", model: "openrouter/test", trustedRepoRoot: "/repo" },
      { id: "rev-1", issueCount: 3 },
      true,
    );
    expect(context).toEqual({
      providerName: "openrouter",
      providerMode: "openrouter/test",
      lastRunId: "rev-1",
      lastRunIssueCount: 3,
      trustedDir: "/repo",
    });
  });

  it("omits the trusted directory when read access is not granted", () => {
    const context = buildHomeContextInfo(
      { provider: "openrouter", model: "openrouter/test", trustedRepoRoot: "/repo" },
      undefined,
      false,
    );
    expect(context.trustedDir).toBeUndefined();
  });

  it("normalizes null provider and model to undefined", () => {
    const context = buildHomeContextInfo(
      { provider: null, model: null, trustedRepoRoot: null },
      null,
      true,
    );
    expect(context).toEqual({
      providerName: undefined,
      providerMode: undefined,
      lastRunId: undefined,
      lastRunIssueCount: undefined,
      trustedDir: undefined,
    });
  });
});

describe("presentation type runtime", () => {
  it("erases presentation-only contracts and retains their public types", () => {
    for (const fileName of ["context-info.ts", "issue-tabs.ts", "severity.ts", "shortcuts.ts"]) {
      expect(transpilePresentationModule(fileName)).not.toContain("zod");
    }

    const logOutput = transpilePresentationModule("log.ts");
    expect(logOutput.match(/z\.enum/g) ?? []).toHaveLength(1);
    expect(logOutput).not.toMatch(/z\.(object|union|string|date|boolean)/);

    expectTypeOf<ContextInfo>().toEqualTypeOf<{
      trustedDir?: string;
      providerName?: string;
      providerMode?: string;
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

    expect(BadgeVariantSchema.safeParse("info").success).toBe(true);
    expect(BadgeVariantSchema.safeParse("unknown").success).toBe(false);
  });
});
