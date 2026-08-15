import { describe, expect, it } from "vitest";
import { assertClientSafePayload } from "./client-safe-assertions";

function nestTo(depth: number, leaf: unknown): unknown {
  let value = leaf;
  for (let level = 0; level < depth; level += 1) {
    value = { child: value };
  }
  return value;
}

describe("assertClientSafePayload", () => {
  it("accepts a payload that carries no credential keys or secret-like values", () => {
    expect(() =>
      assertClientSafePayload({ configurations: [{ productId: "gemini", model: "flash" }] }),
    ).not.toThrow();
  });

  it("reports a credential key with its path", () => {
    expect(() => assertClientSafePayload({ provider: { apiKey: "value" } })).toThrow(
      /provider\.apiKey: forbidden key/,
    );
  });

  it("reports a secret-like value however deeply the response nests it", () => {
    expect(() => assertClientSafePayload(nestTo(20, { note: "sk-abcdefghijklmnop" }))).toThrow(
      /forbidden secret-like value/,
    );
  });

  it("scans the tail of a wide response instead of stopping partway", () => {
    const wide = {
      entries: Array.from({ length: 600 }, (_, index) =>
        index === 599 ? "sk-abcdefghijklmnop" : `entry-${index}`,
      ),
    };

    expect(() => assertClientSafePayload(wide)).toThrow(/forbidden secret-like value/);
  });
});
