import { createDeferred } from "@diffgazer/core/testing/deferred";
import { describe, expect, it } from "vitest";
import { createKeyedLock } from "./keyed-lock.js";

describe("createKeyedLock", () => {
  it("continues in FIFO order after rejection and removes only the settled queue tail", async () => {
    const registry = new Map<string, Promise<unknown>>();
    const withLock = createKeyedLock(registry);
    const firstGate = createDeferred<void>();
    const secondGate = createDeferred<void>();
    const firstStarted = createDeferred<void>();
    const secondStarted = createDeferred<void>();
    const failure = new Error("first operation failed");
    const order: string[] = [];

    const first = withLock("project", async () => {
      order.push("first");
      firstStarted.resolve();
      await firstGate.promise;
    });
    await firstStarted.promise;

    const second = withLock("project", async () => {
      order.push("second");
      secondStarted.resolve();
      await secondGate.promise;
    });
    firstGate.reject(failure);

    await expect(first).rejects.toBe(failure);
    await secondStarted.promise;
    expect(registry.size).toBe(1);

    const third = withLock("project", async () => {
      order.push("third");
    });
    await Promise.resolve();
    expect(order).toEqual(["first", "second"]);

    secondGate.resolve();
    await Promise.all([second, third]);

    expect(order).toEqual(["first", "second", "third"]);
    expect(registry.size).toBe(0);
  });
});
