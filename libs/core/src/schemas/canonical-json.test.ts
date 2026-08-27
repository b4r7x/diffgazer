import { describe, expect, it } from "vitest";
import { canonicalJson, sha256CanonicalJsonSync } from "./canonical-json.js";
import { scanJsonRejectingDuplicateKeys } from "./json-scan.js";

const canonicalByteLength = (value: unknown) =>
  new TextEncoder().encode(canonicalJson(value)).length;

function keyPaddingObject(repeatCount: number): Record<string, number> {
  return { ["k".repeat(repeatCount)]: 1 };
}

// Mirrors the bounds the receipt-capture scan applies to live provider output.
const SCAN_MAX_BYTES = 64 * 1024;
const SCAN_MAX_DEPTH = 32;
const SCAN_MAX_COLLECTION_ITEMS = 4_096;
const SCAN_MAX_VALUES = 16_384;

class ScanFailure extends Error {
  constructor(readonly reason: string) {
    super(`Scan failed: ${reason}`);
  }
}

function scanJson(text: string): void {
  scanJsonRejectingDuplicateKeys(text, {
    maxBytes: SCAN_MAX_BYTES,
    maxDepth: SCAN_MAX_DEPTH,
    maxCollectionItems: SCAN_MAX_COLLECTION_ITEMS,
    maxValues: SCAN_MAX_VALUES,
    onFail: ({ reason }) => {
      throw new ScanFailure(reason);
    },
  });
}

function captureScanFailure(scan: () => void): ScanFailure {
  try {
    scan();
  } catch (error) {
    if (error instanceof ScanFailure) return error;
    throw error;
  }
  throw new Error("Expected the JSON scan to fail");
}

function zeroMatrixJson(outerCount: number, innerCount: number): string {
  const inner = `[${Array.from({ length: innerCount }, () => "0").join(",")}]`;
  return `[${Array.from({ length: outerCount }, () => inner).join(",")}]`;
}

describe("canonical JSON", () => {
  it("produces a deterministic lowercase SHA-256 vector from canonical UTF-8 JSON", () => {
    expect(canonicalJson({ z: 1, a: 2 })).toBe('{"a":2,"z":1}');
    expect(canonicalJson({ list: ["z", "a"], nested: { z: null, a: true } })).toBe(
      '{"list":["z","a"],"nested":{"a":true,"z":null}}',
    );

    const digest = sha256CanonicalJsonSync({ z: 1, a: 2 });

    expect(digest).toBe("c2985c5ba6f7d2a55e768f92490ca09388e95bc4cccb9fdf11b15f4d42f93e73");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects values that cannot have an unambiguous canonical JSON encoding", () => {
    expect(() => canonicalJson({ value: undefined })).toThrow("does not support undefined");
    expect(() => canonicalJson({ value: Number.POSITIVE_INFINITY })).toThrow(
      "requires finite numbers",
    );
    expect(() => canonicalJson(new Array(1))).toThrow("does not accept sparse arrays");
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow("cyclic values");
  });
});

describe("bounded duplicate-key JSON scan", () => {
  it("rejects duplicate keys before the caller materializes untrusted JSON", () => {
    expect(() => scanJson('{"a":1,"a":2}')).toThrow("duplicate object key");
    expect(() => scanJson('{"outer":{"a":1,"a":2}}')).toThrow("duplicate object key");
    expect(() => scanJson('{"a":')).toThrow("expected JSON value");
    expect(() => scanJson('{"z":1,"a":[true,null]}')).not.toThrow();
  });

  it("does not include untrusted duplicate keys in scan diagnostics", () => {
    const secretLikeKey = "authorization-token=super-secret-value";
    const error = captureScanFailure(() => scanJson(`{"${secretLikeKey}":1,"${secretLikeKey}":2}`));

    expect(error.reason).toBe("duplicate object key");
    expect(error.message).not.toContain(secretLikeKey);
  });

  it("accepts only the four JSON whitespace characters", () => {
    for (const whitespace of [" ", "\t", "\n", "\r"]) {
      expect(() => scanJson(`${whitespace}{"a":1}${whitespace}`)).not.toThrow();
      expect(() => scanJson(`{"a"${whitespace}:1}`)).not.toThrow();
    }

    for (const whitespace of [
      "\u000b",
      "\u000c",
      "\u0085",
      "\u00a0",
      "\u2028",
      "\u2029",
      "\ufeff",
    ]) {
      expect(() => scanJson(`${whitespace}{"a":1}`)).toThrow(ScanFailure);
      expect(() => scanJson(`{"a"${whitespace}:1}`)).toThrow(ScanFailure);
      expect(() => scanJson(`{"a":1}${whitespace}`)).toThrow(ScanFailure);
    }
  });

  it("fails before scanning oversized, deeply nested, or wide JSON", () => {
    const oversized = `"${"x".repeat(SCAN_MAX_BYTES)}"`;
    expect(() => scanJson(oversized)).toThrow(ScanFailure);
    expect(() => scanJson(oversized)).toThrow("bounded 64 KiB limit");

    const astralOversized = `"${"😀".repeat(Math.ceil(SCAN_MAX_BYTES / 4))}"`;
    expect(() => scanJson(astralOversized)).toThrow(ScanFailure);

    const deeplyNested = `${"[".repeat(SCAN_MAX_DEPTH + 1)}0${"]".repeat(SCAN_MAX_DEPTH + 1)}`;
    const depthError = captureScanFailure(() => scanJson(deeplyNested));
    expect(depthError).toBeInstanceOf(ScanFailure);
    expect(depthError.reason).toBe("maximum JSON depth exceeded");

    const wide = `[${Array.from({ length: SCAN_MAX_COLLECTION_ITEMS + 1 }, () => "0").join(",")}]`;
    const collectionError = captureScanFailure(() => scanJson(wide));
    expect(collectionError).toBeInstanceOf(ScanFailure);
    expect(collectionError.reason).toBe("maximum JSON collection size exceeded");
  });

  it("caps the aggregate value count even when every other bound is satisfied", () => {
    // 1 outer array + 129 inner arrays + 129 * 126 numbers = exactly SCAN_MAX_VALUES.
    const atLimit = zeroMatrixJson(129, 126);
    expect(new TextEncoder().encode(atLimit).length).toBeLessThan(SCAN_MAX_BYTES);
    expect(() => scanJson(atLimit)).not.toThrow();

    const overLimit = `${atLimit.slice(0, -1)},0]`;
    const valueCountError = captureScanFailure(() => scanJson(overLimit));
    expect(valueCountError.reason).toBe("maximum JSON value count exceeded");
  });
});

describe("sha256CanonicalJsonSync boundary vectors", () => {
  const boundaryVectors = [
    {
      label: "55-byte single-block padding edge",
      repeatCount: 49,
      utf8Length: 55,
      digest: "ef39303fdab38bf7d5a4c7fd0ca09adb09fa8dd0a31fe7fe30c51c43fce1d2f2",
    },
    {
      label: "56-byte second-block padding edge",
      repeatCount: 50,
      utf8Length: 56,
      digest: "800ecf9c0af2c500efc358b3fe9f8f7ddeb79060b2d649a28dec82ce8a74072d",
    },
    {
      label: "63-byte near block boundary",
      repeatCount: 57,
      utf8Length: 63,
      digest: "f537ffb557776bc966164e6ded34b29e984370cc33ca813fb9e0191defa61eff",
    },
    {
      label: "64-byte full block without padding spill",
      repeatCount: 58,
      utf8Length: 64,
      digest: "85a411b6cf2a67eb0c5d989f5e64eae0016968af97e123a24a9a0af7cd6a7f68",
    },
    {
      label: "65-byte second-block payload",
      repeatCount: 59,
      utf8Length: 65,
      digest: "632971007023167d8daf6a2a8bc80fa29f98d3bb34cd8e827d6328c3ba4a1438",
    },
  ] as const;

  it.each(boundaryVectors)("matches an independent SHA-256 oracle for $label", ({
    repeatCount,
    utf8Length,
    digest,
  }) => {
    const value = keyPaddingObject(repeatCount);
    expect(canonicalByteLength(value)).toBe(utf8Length);
    expect(sha256CanonicalJsonSync(value)).toBe(digest);
  });

  it("matches an independent SHA-256 oracle for multi-byte Unicode canonical JSON", () => {
    const value = { emoji: "😀", text: "café" };
    expect(canonicalJson(value)).toBe('{"emoji":"😀","text":"café"}');
    expect(canonicalByteLength(value)).toBe(31);

    expect(sha256CanonicalJsonSync(value)).toBe(
      "6d623d46adcf00bf9c4f904dbd0e3a0b1e8e1dc180c1d6ae5d9b895728511e15",
    );
  });
});
