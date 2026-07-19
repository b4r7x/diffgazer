import { z } from "zod";
import { LensIdSchema } from "./enums.js";

export {
  LENS_IDS,
  type LensId,
  LensIdSchema,
  PROFILE_IDS,
  type ProfileId,
  ProfileIdSchema,
  type ReviewProfile,
  ReviewProfileSchema,
} from "./enums.js";

export const SeverityRubricSchema = z.object({
  blocker: z.string(),
  high: z.string(),
  medium: z.string(),
  low: z.string(),
  nit: z.string(),
});
export type SeverityRubric = z.infer<typeof SeverityRubricSchema>;

export const LensSchema = z.object({
  id: LensIdSchema,
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  severityRubric: SeverityRubricSchema,
});
export type Lens = z.infer<typeof LensSchema>;
