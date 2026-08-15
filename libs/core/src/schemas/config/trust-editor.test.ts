import { describe, expect, test } from "vitest";
import { makeTrustConfig as makeTrust } from "../../testing/factories.js";
import { buildSavePayload, getInitialDraft, resolveEditorView } from "./trust-editor.js";

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
    expect(view.editorKey).not.toBe(draft.editorKey);
    expect(view.capabilities).toEqual({ readFiles: true, runCommands: false });
  });

  test("isTrusted reflects current repository read access", () => {
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

  test("resets a stale draft and access state when the repository root moves", () => {
    const trust = makeTrust();
    const originalInput = {
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust,
    };
    const draft = {
      editorKey: getInitialDraft(originalInput).editorKey,
      capabilities: { readFiles: true, runCommands: false },
    };

    const view = resolveEditorView(draft, {
      ...originalInput,
      repoRoot: "/work/moved-proj",
    });

    expect(view.editorKey).not.toBe(draft.editorKey);
    expect(view.capabilities).toEqual({ readFiles: false, runCommands: false });
    expect(view.isTrusted).toBe(false);
  });

  test("resets a loading draft when project identity resolves", () => {
    const loadingInput = { projectId: null, repoRoot: null, trust: null };
    const draft = getInitialDraft(loadingInput);

    const view = resolveEditorView(draft, {
      projectId: "proj-1",
      repoRoot: "/work/proj",
      trust: makeTrust(),
    });

    expect(view.editorKey).not.toBe(draft.editorKey);
    expect(view.capabilities).toEqual({ readFiles: true, runCommands: false });
    expect(view.isTrusted).toBe(true);
  });
});

describe("buildSavePayload", () => {
  test("echoes the existing trust mode in the save payload", () => {
    const result = buildSavePayload({
      repoRoot: "/work/proj",
      trust: makeTrust({ trustMode: "persistent" }),
      capabilities: { readFiles: true, runCommands: false },
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.payload).toEqual({
      trustMode: "persistent",
      capabilities: { readFiles: true },
    });
    expect("runCommands" in result.payload.capabilities).toBe(false);
    expect("projectId" in result.payload).toBe(false);
    expect("repoRoot" in result.payload).toBe(false);
    expect("trustedAt" in result.payload).toBe(false);
  });

  test("allows a first grant with no existing trust and defaults trustMode to persistent", () => {
    const result = buildSavePayload({
      repoRoot: "/work/proj",
      trust: null,
      capabilities: { readFiles: true, runCommands: false },
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.payload.trustMode).toBe("persistent");
    expect(result.payload).toEqual({
      trustMode: "persistent",
      capabilities: { readFiles: true },
    });
  });

  test("blocks save when repoRoot is missing", () => {
    expect(
      buildSavePayload({
        repoRoot: null,
        trust: null,
        capabilities: { readFiles: true, runCommands: false },
      }),
    ).toEqual({ kind: "blocked", reason: "project-missing" });
  });
});
