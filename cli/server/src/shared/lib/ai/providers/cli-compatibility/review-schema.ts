import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import { LensReviewResultSchema } from "@diffgazer/core/schemas/review";
import { z } from "zod";

export function hashReviewSchemaJson(schemaJson: unknown): string {
  return sha256CanonicalJsonSync(schemaJson);
}

export function buildReviewSchemaJson(): unknown {
  return z.toJSONSchema(LensReviewResultSchema, { target: "draft-7" });
}
