import { vi } from "vitest";
import type { ApiClient } from "./types.js";

export function createMockClient(): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  };
}
