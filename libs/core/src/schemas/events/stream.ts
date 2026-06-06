import { z } from "zod";
import {
  type ReviewStreamEvent as BaseReviewStreamEvent,
  ReviewStreamEventSchema,
} from "../review/issues.js";
import {
  type AgentStreamEvent,
  AgentStreamEventSchema,
} from "./agent.js";
import { type EnrichEvent, EnrichEventSchema } from "./enrich.js";
import { type StepEvent, StepEventSchema } from "./step.js";

// Compose the full event union from the four already-named sub-unions. Adding
// a new event type means extending its owning sub-union; this file does not
// need to change.
export const FullReviewStreamEventSchema = z.discriminatedUnion("type", [
  ...ReviewStreamEventSchema.options,
  ...AgentStreamEventSchema.options,
  ...StepEventSchema.options,
  ...EnrichEventSchema.options,
]);

export type FullReviewStreamEvent = BaseReviewStreamEvent | AgentStreamEvent | StepEvent | EnrichEvent;
