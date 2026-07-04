import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeIntegrity } from "@diffgazer/registry";
import type { CopyBundle } from "@diffgazer/registry/schemas";
import { afterEach, describe, expect, test } from "vitest";
import { createKeysCopyBundleLoader } from "./keys-copy-bundle.js";

const tempRoots: string[] = [];

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

function createTempBundlePath(): string {
  const root = mkdtempSync(join(tmpdir(), "dgadd-keys-copy-bundle-"));
  tempRoots.push(root);
  return join(root, "keys-copy-bundle.json");
}

function writeBundle(bundlePath: string, bundle: CopyBundle): void {
  writeFileSync(bundlePath, JSON.stringify(bundle));
}

function bundleWithValidIntegrity(items: CopyBundle["items"]): CopyBundle {
  return { items, integrity: computeIntegrity(JSON.stringify({ items })) };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("createKeysCopyBundleLoader", () => {
  test("loads a valid bundle whose hash matches its items", () => {
    const bundlePath = createTempBundlePath();
    writeBundle(bundlePath, bundleWithValidIntegrity(SAMPLE_ITEMS));

    const loadBundle = createKeysCopyBundleLoader(bundlePath);

    expect(loadBundle().items).toEqual(SAMPLE_ITEMS);
  });

  test("reports the bundle path when JSON is corrupt", () => {
    const bundlePath = createTempBundlePath();
    writeFileSync(bundlePath, "{");

    const loadBundle = createKeysCopyBundleLoader(bundlePath);

    expect(() => loadBundle()).toThrow(`Failed to parse registry bundle at ${bundlePath}`);
  });

  test("rejects a bundle without integrity", () => {
    const bundlePath = createTempBundlePath();
    writeBundle(bundlePath, { items: SAMPLE_ITEMS });

    const loadBundle = createKeysCopyBundleLoader(bundlePath);

    expect(() => loadBundle()).toThrow(/integrity/);
  });

  test("rejects a bundle whose file content was tampered after hashing", () => {
    const bundlePath = createTempBundlePath();
    const bundle = bundleWithValidIntegrity(SAMPLE_ITEMS);
    const item = bundle.items[0];
    const file = item?.files[0];
    if (!item || !file) {
      throw new Error("Sample copy bundle fixture is missing an item file.");
    }
    writeBundle(bundlePath, {
      ...bundle,
      items: [
        {
          ...item,
          files: [{ ...file, content: "export const useFocusTrap = () => evil();\n" }],
        },
      ],
    });

    const loadBundle = createKeysCopyBundleLoader(bundlePath);

    expect(() => loadBundle()).toThrow(/integrity mismatch/);
  });
});
