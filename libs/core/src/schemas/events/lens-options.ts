import type { LensId } from "../review/lens.js";
import { LENS_TO_AGENT, AGENT_METADATA } from "./agent.js";

export interface LensOption {
  id: LensId;
  label: string;
  badgeLabel: string;
  badgeVariant: "success" | "warning" | "error" | "info" | "neutral";
  description: string;
}

export function buildLensOptions(): LensOption[] {
  return (
    Object.entries(LENS_TO_AGENT) as Array<[LensId, keyof typeof AGENT_METADATA]>
  ).map(([lensId, agentId]) => {
    const meta = AGENT_METADATA[agentId];
    return {
      id: lensId,
      label: meta.name,
      badgeLabel: meta.badgeLabel,
      badgeVariant: meta.badgeVariant,
      description: meta.description,
    };
  });
}
