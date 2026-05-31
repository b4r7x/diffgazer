import { z } from "zod";
import {
  AgentStreamEventSchema,
  type AgentStreamEvent,
} from "./agent.js";
import { EnrichEventSchema, type EnrichEvent } from "./enrich.js";
import {
  ReviewStreamEventSchema,
  type ReviewStreamEvent as BaseReviewStreamEvent,
} from "../review/issues.js";
import { StepEventSchema, type StepEvent } from "./step.js";

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
