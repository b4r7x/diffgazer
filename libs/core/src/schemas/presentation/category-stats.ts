import { z } from "zod";

const CategoryStatsSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number(),
});
export type CategoryStats = z.infer<typeof CategoryStatsSchema>;
