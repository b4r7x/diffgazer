import { describe, expect, it } from "vitest";
import { createDeferred } from "./deferred.js";

describe("createDeferred", () => {
  it("settles through its exposed resolver", async () => {
    const deferred = createDeferred<string>();

    deferred.resolve("ready");

    await expect(deferred.promise).resolves.toBe("ready");
  });

  it("rejects through its exposed rejecter", async () => {
    const deferred = createDeferred<never>();
    const error = new Error("failed");

    deferred.reject(error);

    await expect(deferred.promise).rejects.toBe(error);
  });
});
