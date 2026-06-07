import { computeIntegrity } from "@diffgazer/registry";
import type { CopyBundle } from "@diffgazer/registry/schemas";
import { describe, expect, test } from "vitest";
import { verifyBundleIntegrity } from "./keys-copy-bundle.js";

function bundleWithValidIntegrity(items: CopyBundle["items"]): CopyBundle {
  return { items, integrity: computeIntegrity(JSON.stringify({ items })) };
}

const SAMPLE_ITEMS: CopyBundle["items"] = [
  {
    name: "focus-trap",
    title: "focus-trap",
    description: "Keys hook",
    files: [
      { path: "hooks/use-focus-trap.ts", content: "export const useFocusTrap = () => {};\n" },
    ],
  },
];

describe("verifyBundleIntegrity", () => {
  test("accepts a bundle whose hash matches its items", () => {
    expect(() => verifyBundleIntegrity(bundleWithValidIntegrity(SAMPLE_ITEMS))).not.toThrow();
  });

  test("rejects a bundle whose file content was tampered after hashing", () => {
    const bundle = bundleWithValidIntegrity(SAMPLE_ITEMS);
    const item = bundle.items.at(0);
    const file = item?.files.at(0);
    if (!item || !file) {
      throw new Error("Sample copy bundle fixture is missing an item file.");
    }

    const tampered: CopyBundle = {
      ...bundle,
      items: [
        {
          ...item,
          files: [{ ...file, content: "export const useFocusTrap = () => evil();\n" }],
        },
      ],
    };

    expect(() => verifyBundleIntegrity(tampered)).toThrow(/failed integrity verification/);
  });

  test("rejects a bundle with no integrity hash", () => {
    expect(() => verifyBundleIntegrity({ items: SAMPLE_ITEMS })).toThrow(
      /missing an integrity hash/,
    );
  });
});
