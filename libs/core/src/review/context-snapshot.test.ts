import { describe, expect, it } from "vitest";
import type { ReviewContextResponse } from "../api/types.js";
import { buildContextSnapshotView, buildReviewContextResponse } from "./context-snapshot.js";

function makeSnapshot(): ReviewContextResponse {
  const generatedAt = "2026-07-19T08:00:00.000Z";
  return {
    text: Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join("\n"),
    markdown: "# Context",
    graph: {
      generatedAt,
      root: "C:\\work\\diffgazer",
      packages: [
        { name: "web", dir: "apps/web", kind: "app" },
        { name: "core", dir: "libs/core", kind: "package" },
      ],
      edges: [],
      fileTree: [],
      changedFiles: [
        { filePath: "a.ts", operation: "modified", additions: 7, deletions: 2 },
        { filePath: "b.ts", operation: "added", additions: 3, deletions: 0 },
      ],
    },
    meta: {
      generatedAt,
      root: "C:\\work\\diffgazer",
      statusHash: "hash",
      statusHashKind: "full",
      charCount: 86,
    },
  };
}

describe("buildContextSnapshotView", () => {
  it("projects shared stats and the first ten preview lines", () => {
    expect(buildContextSnapshotView(makeSnapshot())).toEqual({
      project: "diffgazer",
      changedFileCount: 2,
      additions: 10,
      deletions: 2,
      packageCount: 2,
      charCount: 86,
      previewLines: Array.from({ length: 10 }, (_, index) => `line ${index + 1}`),
      previewTruncated: true,
    });
  });

  it.each([
    ["POSIX root", "/", "/"],
    ["Windows drive root", "C:\\", "C:\\"],
    ["Windows share root", "\\\\server\\share\\", "share"],
  ])("retains a useful project label for %s", (_label, root, project) => {
    const snapshot = makeSnapshot();
    snapshot.graph.root = root;

    expect(buildContextSnapshotView(snapshot).project).toBe(project);
  });
});

describe("buildReviewContextResponse", () => {
  it("keeps Markdown for .md output and derives plain text for .txt output", () => {
    const snapshot = makeSnapshot();
    snapshot.markdown = [
      "# Project Context Snapshot",
      "",
      "## Project Info",
      "- Name: **diffgazer**",
      "- [Documentation](https://example.com/docs)",
      "```",
      "literal *README* content",
      "```",
    ].join("\n");

    expect(buildReviewContextResponse(snapshot)).toMatchObject({
      markdown: snapshot.markdown,
      text: [
        "Project Context Snapshot",
        "",
        "Project Info",
        "Name: diffgazer",
        "Documentation",
        "literal *README* content",
      ].join("\n"),
    });
  });
});
