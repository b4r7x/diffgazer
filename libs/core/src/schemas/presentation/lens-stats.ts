import { z } from "zod";

const LensStatsSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  iconColor: z.string().optional(),
  count: z.number(),
  change: z.number(),
});
export type LensStats = z.infer<typeof LensStatsSchema>;
