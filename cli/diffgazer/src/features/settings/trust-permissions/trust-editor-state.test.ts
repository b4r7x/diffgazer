import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import {
  buildSavePayload,
  getInitialDraft,
  getTrustEditorKey,
  resolveEditorView,
} from "./trust-editor-state.js";

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
    assert.equal(
      getTrustEditorKey({ projectId: "proj-1", repoRoot: "/work/proj", trust: makeTrust() }),
      `proj-1:${TRUSTED_AT}`,
    );
  });

  test("falls back to projectId/repoRoot composite when untrusted", () => {
    assert.equal(
      getTrustEditorKey({ projectId: "proj-1", repoRoot: "/work/proj", trust: null }),
      "proj-1:/work/proj:untrusted",
    );
  });

  test("uses loading sentinel when project info is missing", () => {
    assert.equal(
      getTrustEditorKey({ projectId: null, repoRoot: null, trust: null }),
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
    assert.equal(draft.capabilities.readFiles, true);
    assert.equal(draft.capabilities.runCommands, false);
    assert.equal(draft.editorKey, `proj-1:${TRUSTED_AT}`);
  });

  test("defaults to no capabilities when project is untrusted", () => {
    const draft = getInitialDraft({
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: null,
    });
    assert.deepEqual(draft.capabilities, { readFiles: false, runCommands: false });
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
    assert.deepEqual(view.capabilities, { readFiles: false, runCommands: false });
    assert.equal(view.isTrusted, true);
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
    assert.equal(view.editorKey, `proj-1:${refreshedTrust.trustedAt}`);
    assert.deepEqual(view.capabilities, { readFiles: true, runCommands: false });
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
    assert.equal(view.isTrusted, false);
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
    assert.equal(result.kind, "ready");
    if (result.kind !== "ready") return;
    assert.equal(result.payload.projectId, "proj-1");
    assert.equal(result.payload.repoRoot, "/work/proj");
    assert.equal(result.payload.trustMode, "session");
    assert.equal(result.payload.trustedAt, now.toISOString());
    assert.deepEqual(result.payload.capabilities, { readFiles: true, runCommands: false });
  });

  test("defaults trustMode to persistent when no existing trust", () => {
    const result = buildSavePayload({
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: null,
      capabilities: { readFiles: true, runCommands: false },
      now: () => new Date("2026-05-14T10:00:00.000Z"),
    });
    assert.equal(result.kind, "ready");
    if (result.kind !== "ready") return;
    assert.equal(result.payload.trustMode, "persistent");
  });

  test("blocks save when projectId is missing", () => {
    const result = buildSavePayload({
      projectId: null,
      repoRoot: "/work/proj",
      trust: null,
      capabilities: { readFiles: true, runCommands: false },
      now: () => new Date(),
    });
    assert.equal(result.kind, "blocked");
    if (result.kind !== "blocked") return;
    assert.equal(result.reason, "project-missing");
  });

  test("blocks save when repoRoot is missing", () => {
    const result = buildSavePayload({
      projectId: "proj-1",
      repoRoot: null,
      trust: null,
      capabilities: { readFiles: true, runCommands: false },
      now: () => new Date(),
    });
    assert.equal(result.kind, "blocked");
  });

  test("each `now()` invocation produces a fresh trustedAt timestamp", () => {
    let calls = 0;
    const stamps = ["2026-05-14T10:00:00.000Z", "2026-05-14T11:00:00.000Z"];
    const next = () => new Date(stamps[calls++]!);
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
      assert.fail("expected both saves to be ready");
    }
    assert.notEqual(first.payload.trustedAt, second.payload.trustedAt);
  });
});
