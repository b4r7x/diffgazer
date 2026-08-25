import type { LensId, ReviewSeverity } from "./enums.js";

export {
  LENS_IDS,
  type LensId,
  LensIdSchema,
  type ProfileId,
  ProfileIdSchema,
  type ReviewProfile,
  SELECTABLE_LENS_IDS,
  type SelectableLensId,
  SelectableLensIdSchema,
} from "./enums.js";

// Lenses are a closed, source-owned set constructed in the daemon; nothing
// supplies them across a file, network, CLI, or plugin boundary, so they are
// plain types rather than runtime schemas.
export type SeverityRubric = Record<ReviewSeverity, string>;

export interface Lens {
  id: LensId;
  name: string;
  description: string;
  systemPrompt: string;
  severityRubric: SeverityRubric;
}
