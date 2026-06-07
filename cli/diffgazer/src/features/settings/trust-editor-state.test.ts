import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { describe, expect, test } from "vitest";
import {
  buildSavePayload,
  getInitialDraft,
  getTrustEditorKey,
  resolveEditorView,
} from "./trust-editor-state";

const TRUSTED_AT = "2026-05-13T12:00:00.000Z";

function makeTrust(overrides: Partial<TrustConfig> = {}): TrustConfig {
  return {
    projectId: "proj-1",
    repoRoot: "/work/proj",
    trustedAt: TRUSTED_AT,
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
    ...overrides,
  };
}

describe("getTrustEditorKey", () => {
  test("uses trust.projectId and trustedAt when trust is present", () => {
    expect(
      getTrustEditorKey({ projectId: "proj-1", repoRoot: "/work/proj", trust: makeTrust() }),
    ).toBe(`proj-1:${TRUSTED_AT}`);
  });

  test("falls back to projectId/repoRoot composite when untrusted", () => {
    expect(getTrustEditorKey({ projectId: "proj-1", repoRoot: "/work/proj", trust: null })).toBe(
      "proj-1:/work/proj:untrusted",
    );
  });

  test("uses loading sentinel when project info is missing", () => {
    expect(getTrustEditorKey({ projectId: null, repoRoot: null, trust: null })).toBe(
      "loading:loading:untrusted",
    );
  });
});

describe("getInitialDraft", () => {
  test("normalizes capabilities (runCommands always false) from existing trust", () => {
    const draft = getInitialDraft({
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: makeTrust({
        capabilities: { readFiles: true, runCommands: true },
      }),
    });
    expect(draft.capabilities.readFiles).toBe(true);
    expect(draft.capabilities.runCommands).toBe(false);
    expect(draft.editorKey).toBe(`proj-1:${TRUSTED_AT}`);
  });

  test("defaults to no capabilities when project is untrusted", () => {
    const draft = getInitialDraft({
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: null,
    });
    expect(draft.capabilities).toEqual({ readFiles: false, runCommands: false });
  });
});

describe("resolveEditorView", () => {
  test("keeps the user's draft when editor key has not changed", () => {
    const input = {
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: makeTrust(),
    };
    const draft = {
      editorKey: getTrustEditorKey(input),
      capabilities: { readFiles: false, runCommands: false },
    };
    const view = resolveEditorView(draft, input);
    expect(view.capabilities).toEqual({ readFiles: false, runCommands: false });
    expect(view.isTrusted).toBe(true);
  });

  test("resets to persisted capabilities when trust audit timestamp changes", () => {
    const initialInput = {
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: makeTrust(),
    };
    const draft = {
      editorKey: getTrustEditorKey(initialInput),
      capabilities: { readFiles: false, runCommands: false },
    };
    const refreshedTrust = makeTrust({ trustedAt: "2026-05-13T13:00:00.000Z" });
    const refreshedInput = {
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: refreshedTrust,
    };
    const view = resolveEditorView(draft, refreshedInput);
    expect(view.editorKey).toBe(`proj-1:${refreshedTrust.trustedAt}`);
    expect(view.capabilities).toEqual({ readFiles: true, runCommands: false });
  });

  test("isTrusted reflects current trust.capabilities.readFiles only", () => {
    const view = resolveEditorView(
      { editorKey: "irrelevant", capabilities: { readFiles: false, runCommands: false } },
      {
        projectId: "proj-1",
        repoRoot: "/work/proj",
        trust: makeTrust({ capabilities: { readFiles: false, runCommands: false } }),
      },
    );
    expect(view.isTrusted).toBe(false);
  });
});

describe("buildSavePayload", () => {
  test("returns ready payload preserving trustMode and stamping trustedAt", () => {
    const now = new Date("2026-05-14T10:00:00.000Z");
    const result = buildSavePayload({
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: makeTrust({ trustMode: "session" }),
      capabilities: { readFiles: true, runCommands: false },
      now: () => now,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.payload.projectId).toBe("proj-1");
    expect(result.payload.repoRoot).toBe("/work/proj");
    expect(result.payload.trustMode).toBe("session");
    expect(result.payload.trustedAt).toBe(now.toISOString());
    expect(result.payload.capabilities).toEqual({ readFiles: true, runCommands: false });
  });

  test("defaults trustMode to persistent when no existing trust", () => {
    const result = buildSavePayload({
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: null,
      capabilities: { readFiles: true, runCommands: false },
      now: () => new Date("2026-05-14T10:00:00.000Z"),
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.payload.trustMode).toBe("persistent");
  });

  test("blocks save when projectId is missing", () => {
    const result = buildSavePayload({
      projectId: null,
      repoRoot: "/work/proj",
      trust: null,
      capabilities: { readFiles: true, runCommands: false },
      now: () => new Date(),
    });
    expect(result.kind).toBe("blocked");
    if (result.kind !== "blocked") return;
    expect(result.reason).toBe("project-missing");
  });

  test("blocks save when repoRoot is missing", () => {
    const result = buildSavePayload({
      projectId: "proj-1",
      repoRoot: null,
      trust: null,
      capabilities: { readFiles: true, runCommands: false },
      now: () => new Date(),
    });
    expect(result.kind).toBe("blocked");
  });

  test("each `now()` invocation produces a fresh trustedAt timestamp", () => {
    let calls = 0;
    const stamps = ["2026-05-14T10:00:00.000Z", "2026-05-14T11:00:00.000Z"];
    const next = () => {
      const stamp = stamps[calls++];
      if (stamp === undefined) throw new Error("ran out of timestamps");
      return new Date(stamp);
    };
    const first = buildSavePayload({
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: null,
      capabilities: { readFiles: true, runCommands: false },
      now: next,
    });
    const second = buildSavePayload({
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: null,
      capabilities: { readFiles: true, runCommands: false },
      now: next,
    });
    if (first.kind !== "ready" || second.kind !== "ready") {
      expect.fail("expected both saves to be ready");
    }
    expect(first.payload.trustedAt).not.toBe(second.payload.trustedAt);
  });
});
