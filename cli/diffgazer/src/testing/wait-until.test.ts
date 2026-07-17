import { describe, expect, test } from "vitest";
import { waitUntil } from "./wait-until";

describe("waitUntil", () => {
  test("rejects when the predicate never becomes true", async () => {
    await expect(waitUntil(() => false, { attempts: 2, intervalMs: 0 })).rejects.toThrow(
      "Timed out waiting for condition after 2 attempts",
    );
  });
});
