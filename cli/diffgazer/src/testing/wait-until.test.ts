import { describe, expect, test } from "vitest";
import { waitUntil } from "./wait-until";

describe("waitUntil", () => {
  test("rejects when the predicate never becomes true", async () => {
    await expect(waitUntil(() => false, { attempts: 2, intervalMs: 0 })).rejects.toThrow(
      "Timed out waiting for condition after 2 attempts",
    );
  });

  test("resolves on the check where the predicate flips true", async () => {
    let calls = 0;
    await expect(
      waitUntil(() => ++calls === 2, { attempts: 5, intervalMs: 0 }),
    ).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });
});
