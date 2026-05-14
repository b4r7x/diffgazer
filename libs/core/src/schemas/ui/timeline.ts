import { z } from "zod";

const TimelineItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  count: z.number(),
});
export type TimelineItem = z.infer<typeof TimelineItemSchema>;
