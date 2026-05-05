import { readFileSync, writeFileSync } from "node:fs";
import type { z } from "zod";

export function readJson<T>(filePath: string, schema: z.ZodType<T>): T;
export function readJson(filePath: string): unknown;
export function readJson<T>(filePath: string, schema?: z.ZodType<T>): T | unknown {
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  return schema ? schema.parse(raw) : raw;
}

export function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
