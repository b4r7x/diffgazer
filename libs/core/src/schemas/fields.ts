import { z } from "zod";

export const UuidSchema = z.uuid();

export const timestampFields = {
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
} as const;

export const createdAtField = {
  createdAt: z.iso.datetime(),
} as const;
