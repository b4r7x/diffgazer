import { describe, expect, test } from "vitest";
import type { TrustConfig } from "./settings.js";
import { buildSavePayload, getInitialDraft, resolveEditorView } from "./trust-editor.js";

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

describe("editorKey", () => {
  test("uses trust.projectId and trustedAt when trust is present", () => {
    expect(
      getInitialDraft({ projectId: "proj-1", repoRoot: "/work/proj", trust: makeTrust() })
        .editorKey,
    ).toBe(`proj-1:${TRUSTED_AT}`);
  });

  test("falls back to projectId/repoRoot composite when untrusted", () => {
    expect(
      getInitialDraft({ projectId: "proj-1", repoRoot: "/work/proj", trust: null }).editorKey,
    ).toBe("proj-1:/work/proj:untrusted");
  });

  test("uses loading sentinel when project info is missing", () => {
    expect(getInitialDraft({ projectId: null, repoRoot: null, trust: null }).editorKey).toBe(
      "loading:loading:untrusted",
    );
  });
});

describe("getInitialDraft", () => {
  test("normalizes capabilities from existing trust", () => {
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
      editorKey: getInitialDraft(input).editorKey,
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
      editorKey: getInitialDraft(initialInput).editorKey,
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
  test("returns a ready request carrying only client-controlled fields", () => {
    const result = buildSavePayload({
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: makeTrust({ trustMode: "session" }),
      capabilities: { readFiles: true, runCommands: false },
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.payload).toEqual({
      trustMode: "session",
      capabilities: { readFiles: true },
    });
    expect("runCommands" in result.payload.capabilities).toBe(false);
    expect("projectId" in result.payload).toBe(false);
    expect("repoRoot" in result.payload).toBe(false);
    expect("trustedAt" in result.payload).toBe(false);
  });

  test("defaults trustMode to persistent when no existing trust", () => {
    const result = buildSavePayload({
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: null,
      capabilities: { readFiles: true, runCommands: false },
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.payload.trustMode).toBe("persistent");
  });

  test("blocks save when projectId or repoRoot is missing", () => {
    expect(
      buildSavePayload({
        projectId: null,
        repoRoot: "/work/proj",
        trust: null,
        capabilities: { readFiles: true, runCommands: false },
      }),
    ).toEqual({ kind: "blocked", reason: "project-missing" });

    expect(
      buildSavePayload({
        projectId: "proj-1",
        repoRoot: null,
        trust: null,
        capabilities: { readFiles: true, runCommands: false },
      }),
    ).toEqual({ kind: "blocked", reason: "project-missing" });
  });
});
