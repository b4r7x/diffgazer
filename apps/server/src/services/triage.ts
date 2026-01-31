import { createGitService } from "./git.js";
import type { AIClient } from "../ai/index.js";
import { getErrorMessage } from "@repo/core";
import { parseDiff, filterDiffByFiles } from "../diff/index.js";
import { triageReviewStream, getProfile } from "../review/index.js";
import { saveTriageReview } from "../storage/index.js";
import type { TriageResult, TriageOptions as SchemaTriageOptions } from "@repo/schemas/triage";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import { ErrorCode } from "@repo/schemas/errors";
import type { SSEWriter } from "../lib/ai-client.js";
import { writeSSEError } from "../lib/sse-helpers.js";
import { createGitDiffError } from "./review.js";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import type { StepEvent } from "@repo/schemas/step-event";

const MAX_DIFF_SIZE_BYTES = 524288; // 512KB

const gitService = createGitService();

async function writeStreamEvent(stream: SSEWriter, event: AgentStreamEvent | StepEvent): Promise<void> {
  await stream.writeSSE({
    event: event.type,
    data: JSON.stringify(event),
  });
}

async function writeTriageComplete(stream: SSEWriter, result: TriageResult, reviewId: string): Promise<void> {
  await stream.writeSSE({
    event: "complete",
    data: JSON.stringify({ type: "complete", result, reviewId }),
  });
}

// Server-specific triage options extending schema options
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

    const result = await triageReviewStream(
      aiClient,
      parsed,
      {
        lenses: activeLenses as LensId[],
        filter: profile?.filter,
      },
      async (event) => {
        await writeStreamEvent(stream, event);
      }
    );

    if (!result.ok) {
      await writeSSEError(stream, result.error.message, "AI_ERROR");
      return;
    }

    const finalResult = result.value;
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
    try {
      await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
    } catch {
      throw error;
    }
  }
}
