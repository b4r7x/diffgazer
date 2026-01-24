import { createGitService } from "./git.js";
import type { AIClient } from "@repo/core/ai";
import { getErrorMessage } from "@repo/core";
import { parseDiff, filterDiffByFiles } from "@repo/core/diff";
import { triageReview, getLenses, getProfile } from "@repo/core/review";
import { saveTriageReview } from "@repo/core/storage";
import type { TriageResult } from "@repo/schemas/triage";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import { ErrorCode } from "@repo/schemas/errors";
import type { SSEWriter } from "../lib/ai-client.js";
import { writeSSEChunk, writeSSEError } from "../lib/sse-helpers.js";
import { createGitDiffError } from "./review.js";

const MAX_DIFF_SIZE_BYTES = 524288; // 512KB

const gitService = createGitService();

async function writeTriageLensStart(
  stream: SSEWriter,
  lens: string,
  index: number,
  total: number
): Promise<void> {
  await stream.writeSSE({
    event: "lens_start",
    data: JSON.stringify({ type: "lens_start", lens, index, total }),
  });
}

async function writeTriageLensComplete(stream: SSEWriter, lens: string): Promise<void> {
  await stream.writeSSE({
    event: "lens_complete",
    data: JSON.stringify({ type: "lens_complete", lens }),
  });
}

async function writeTriageComplete(stream: SSEWriter, result: TriageResult, reviewId: string): Promise<void> {
  await stream.writeSSE({
    event: "complete",
    data: JSON.stringify({ type: "complete", result, reviewId }),
  });
}

export interface TriageOptions {
  staged?: boolean;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
}

export async function streamTriageToSSE(
  aiClient: AIClient,
  options: TriageOptions,
  stream: SSEWriter
): Promise<void> {
  const { staged = true, files, lenses: lensIds, profile: profileId } = options;

  try {
    let diff: string;
    try {
      diff = await gitService.getDiff(staged);
    } catch (error: unknown) {
      await writeSSEError(stream, createGitDiffError(error).message, ErrorCode.GIT_NOT_FOUND);
      return;
    }

    if (!diff.trim()) {
      await writeSSEError(
        stream,
        `No ${staged ? "staged" : "unstaged"} changes to review`,
        "NO_DIFF"
      );
      return;
    }

    let parsed = parseDiff(diff);

    if (files && files.length > 0) {
      parsed = filterDiffByFiles(parsed, files);
      if (parsed.files.length === 0) {
        await writeSSEError(
          stream,
          `None of the specified files have ${staged ? "staged" : "unstaged"} changes`,
          "NO_DIFF"
        );
        return;
      }
    }

    if (parsed.totalStats.totalSizeBytes > MAX_DIFF_SIZE_BYTES) {
      await writeSSEError(
        stream,
        `Diff size (${parsed.totalStats.totalSizeBytes} bytes) exceeds maximum allowed size (${MAX_DIFF_SIZE_BYTES} bytes)`,
        ErrorCode.VALIDATION_ERROR
      );
      return;
    }

    const profile = profileId ? getProfile(profileId) : undefined;
    const activeLenses = lensIds ?? profile?.lenses ?? ["correctness"];
    const lenses = getLenses(activeLenses as LensId[]);

    const allIssues: TriageResult["issues"] = [];
    const summaries: string[] = [];

    for (let i = 0; i < lenses.length; i++) {
      const lens = lenses[i];
      if (!lens) continue;

      await writeTriageLensStart(stream, lens.name, i, lenses.length);

      const result = await triageReview(aiClient, parsed, {
        lenses: [lens.id],
        filter: profile?.filter,
      });

      if (!result.ok) {
        await writeSSEError(stream, result.error.message, "AI_ERROR");
        return;
      }

      allIssues.push(...result.value.issues);
      summaries.push(result.value.summary);
      await writeTriageLensComplete(stream, lens.name);
    }

    const finalResult: TriageResult = {
      summary: summaries.join("\n\n"),
      issues: allIssues,
    };

    const status = await gitService.getStatus().catch(() => null);

    const saveResult = await saveTriageReview({
      projectPath: process.cwd(),
      staged,
      result: finalResult,
      diff: parsed,
      branch: status?.branch ?? null,
      commit: null,
      profile: profileId,
      lenses: activeLenses as LensId[],
    });

    if (!saveResult.ok) {
      await writeSSEError(stream, saveResult.error.message, ErrorCode.INTERNAL_ERROR);
      return;
    }

    await writeTriageComplete(stream, finalResult, saveResult.value.id);
  } catch (error) {
    console.error("[Triage] Unexpected error during triage:", error);
    try {
      await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
    } catch {
      // Stream already closed, cannot send error - will be handled by route-level catch
      throw error;
    }
  }
}
