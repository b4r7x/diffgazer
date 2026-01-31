import { useEffect, useCallback, useRef } from "react";
import { useApp } from "ink";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type TriageResult,
  type TriageError,
  type TriageStreamEvent,
  type TriageIssue,
  TriageStreamEventSchema,
} from "@repo/schemas/triage";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import { getErrorMessage, isAbortError } from "@repo/core";
import { streamTriage } from "../api/index.js";

export interface GithubAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: "notice" | "warning" | "failure";
  message: string;
  title: string;
}

export interface PrReviewOutput {
  summary: string;
  issueCount: number;
  blockerCount: number;
  highCount: number;
  annotations: GithubAnnotation[];
}

interface PrReviewAppProps {
  staged: boolean;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
  outputPath: string;
  onComplete: (exitCode: number) => void;
}

function severityToAnnotationLevel(
  severity: TriageIssue["severity"]
): GithubAnnotation["annotation_level"] {
  switch (severity) {
    case "blocker":
    case "high":
      return "failure";
    case "medium":
      return "warning";
    case "low":
    case "nit":
      return "notice";
  }
}

function issueToAnnotation(issue: TriageIssue): GithubAnnotation {
  return {
    path: issue.file,
    start_line: issue.line_start ?? 1,
    end_line: issue.line_end ?? issue.line_start ?? 1,
    annotation_level: severityToAnnotationLevel(issue.severity),
    message: `${issue.rationale}\n\nRecommendation: ${issue.recommendation}`,
    title: `[${issue.severity.toUpperCase()}] ${issue.title}`,
  };
}

function buildOutput(result: TriageResult): PrReviewOutput {
  const annotations = result.issues.map(issueToAnnotation);
  const blockerCount = result.issues.filter((i) => i.severity === "blocker").length;
  const highCount = result.issues.filter((i) => i.severity === "high").length;

  return {
    summary: result.summary,
    issueCount: result.issues.length,
    blockerCount,
    highCount,
    annotations,
  };
}

export function PrReviewApp({
  staged,
  files,
  lenses,
  profile,
  outputPath,
  onComplete,
}: PrReviewAppProps): null {
  const { exit } = useApp();
  const hasStarted = useRef(false);

  const handleComplete = useCallback(
    async (result: TriageResult) => {
      const output = buildOutput(result);
      const absolutePath = resolve(process.cwd(), outputPath);

      try {
        await writeFile(absolutePath, JSON.stringify(output, null, 2), "utf-8");
        console.log(`Wrote ${output.annotations.length} annotations to ${absolutePath}`);

        if (output.blockerCount > 0) {
          console.log(`Found ${output.blockerCount} blocker issue(s)`);
          onComplete(1);
        } else if (output.highCount > 0) {
          console.log(`Found ${output.highCount} high severity issue(s)`);
          onComplete(1);
        } else if (output.issueCount > 0) {
          console.log(`Found ${output.issueCount} issue(s) (no blockers or high severity)`);
          onComplete(0);
        } else {
          console.log("No issues found");
          onComplete(0);
        }
        exit();
      } catch (error) {
        console.error(`Failed to write output: ${getErrorMessage(error)}`);
        onComplete(1);
        exit();
      }
    },
    [outputPath, onComplete, exit]
  );

  const handleError = useCallback(
    (error: TriageError) => {
      console.error(`Review failed: ${error.message}`);
      onComplete(1);
      exit();
    },
    [onComplete, exit]
  );

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const controller = new AbortController();

    async function runTriage(): Promise<void> {
      console.log("Starting PR review...");
      if (profile) {
        console.log(`Using profile: ${profile}`);
      }
      if (lenses && lenses.length > 0) {
        console.log(`Using lenses: ${lenses.join(", ")}`);
      }

      try {
        const res = await streamTriage({
          staged,
          files,
          lenses,
          profile,
          signal: controller.signal,
        });

        const reader = res.body?.getReader();
        if (!reader) {
          console.error("No response body");
          onComplete(1);
          exit();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data) as unknown;
              const result = TriageStreamEventSchema.safeParse(parsed);
              if (!result.success) continue;

              const event: TriageStreamEvent = result.data;

              if (event.type === "lens_start") {
                console.log(`Analyzing with ${event.lens} lens (${event.index + 1}/${event.total})...`);
              } else if (event.type === "lens_complete") {
                console.log(`Completed ${event.lens} lens`);
              } else if (event.type === "complete") {
                await handleComplete(event.result);
                return;
              } else if (event.type === "error") {
                handleError(event.error);
                return;
              }
            } catch {
              // Ignore parse errors for individual events
            }
          }
        }

        console.error("Stream ended without completion event");
        onComplete(1);
        exit();
      } catch (error) {
        if (!isAbortError(error)) {
          console.error(`Review failed: ${getErrorMessage(error)}`);
          onComplete(1);
          exit();
        }
      }
    }

    void runTriage();

    return () => {
      controller.abort();
    };
  }, [staged, files, lenses, profile, handleComplete, handleError, onComplete, exit]);

  return null;
}
