import { z } from "zod";

export const UuidSchema = z.uuid();

export const timestampFields = {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
} as const;

export const createdAtField = {
  createdAt: z.string().datetime(),
} as const;
