import { vi } from "vitest";

export const isNodeError = vi.fn(
  (error: unknown): error is NodeJS.ErrnoException =>
    error instanceof Error && "code" in error,
);

export const readJsonFileSync: any = vi.fn();
export const writeJsonFileSync: any = vi.fn();
export const removeFileSync: any = vi.fn();
export const readJsonFile: any = vi.fn();
export const writeJsonFile: any = vi.fn();
export const atomicWriteFile: any = vi.fn();
