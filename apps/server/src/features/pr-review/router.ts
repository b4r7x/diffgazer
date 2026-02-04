import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import type { TriageIssue } from "@repo/schemas/triage";
import { errorResponse, zodErrorHandler } from "../../shared/lib/response.js";
import { initializeAIClient } from "../../shared/lib/ai-client.js";
import { parseDiff } from "../../shared/lib/diff/index.js";
import { getLenses, getProfile, triageReview } from "../../shared/lib/review/index.js";
import { buildPrReviewResponse } from "./service.js";
import { PRReviewRequestSchema } from "./schemas.js";

const prReviewRouter = new Hono();

prReviewRouter.post(
  "/",
  zValidator("json", PRReviewRequestSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const body = c.req.valid("json");

    const clientResult = initializeAIClient();
    if (!clientResult.ok) {
      return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
    }

    const parsed = parseDiff(body.diff);
    if (parsed.files.length === 0) {
      return errorResponse(c, "No parseable diff content found", "NO_DIFF", 400);
    }

    const profile = body.profile ? getProfile(body.profile as ProfileId) : undefined;
    const activeLenses = body.lenses
      ? (body.lenses as LensId[])
      : profile?.lenses ?? ["correctness"];
    const lenses = getLenses(activeLenses);

    const allIssues: TriageIssue[] = [];
    const summaries: string[] = [];

    for (const lens of lenses) {
      const result = await triageReview(clientResult.value, parsed, {
        lenses: [lens.id],
        filter: profile?.filter,
      });

      if (!result.ok) {
        return errorResponse(c, result.error.message, "AI_ERROR", 500);
      }

      allIssues.push(...result.value.issues);
      summaries.push(result.value.summary);
    }

    return c.json(buildPrReviewResponse(allIssues, summaries));
  }
);

export { prReviewRouter };
