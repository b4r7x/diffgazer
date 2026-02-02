import { z } from "zod";

export const MIN_PORT = 1;
export const MAX_PORT = 65535;

export const PortSchema = z.coerce.number().int().min(MIN_PORT).max(MAX_PORT);

export type Port = z.infer<typeof PortSchema>;
