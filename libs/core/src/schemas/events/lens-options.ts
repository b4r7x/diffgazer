import type { BadgeVariant } from "../presentation/log.js";
import { SELECTABLE_LENS_IDS, type SelectableLensId } from "../review/lens.js";
import { AGENT_METADATA, LENS_TO_AGENT } from "./agent.js";

export interface LensOption {
  id: SelectableLensId;
  label: string;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
  description: string;
}

// Derived from SELECTABLE_LENS_IDS, not from LENS_TO_AGENT: the engine-only
// `synthesis` lens has an agent too, and must never reach a lens picker.
export const LENS_OPTIONS: readonly LensOption[] = SELECTABLE_LENS_IDS.map((lensId) => {
  const meta = AGENT_METADATA[LENS_TO_AGENT[lensId]];
  return {
    id: lensId,
    label: meta.name,
    badgeLabel: meta.badgeLabel,
    badgeVariant: meta.badgeVariant,
    description: meta.description,
  };
});
