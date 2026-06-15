import { z } from "zod";

const CategoryStatsSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  iconColor: z.string().optional(),
  count: z.number(),
  change: z.number(),
});
export type CategoryStats = z.infer<typeof CategoryStatsSchema>;
