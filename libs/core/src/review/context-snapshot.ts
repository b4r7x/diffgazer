import type { ReviewContextResponse } from "../api/types.js";
import type { ProjectContextSnapshot } from "../schemas/context.js";

const CONTEXT_PREVIEW_LINE_COUNT = 10;

export interface ContextSnapshotView {
  project: string;
  changedFileCount: number;
  additions: number;
  deletions: number;
  packageCount: number;
  charCount: number;
  previewLines: readonly string[];
  previewTruncated: boolean;
}

function getProjectLabel(root: string): string {
  const withoutTrailingSeparators = root.replace(/[\\/]+$/, "");
  if (!withoutTrailingSeparators) return root;
  if (/^[A-Za-z]:$/.test(withoutTrailingSeparators)) return root;
  return withoutTrailingSeparators.split(/[\\/]/).at(-1) ?? root;
}

function markdownToPlainText(markdown: string): string {
  let isCodeBlock = false;
  const lines: string[] = [];

  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      isCodeBlock = !isCodeBlock;
      continue;
    }

    if (isCodeBlock) {
      lines.push(line);
      continue;
    }

    lines.push(
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^(\s*)[-*+]\s+/, "$1")
        .replace(/\[([^\]]+)]\([^\s)]+\)/g, "$1")
        .replace(/([*_~])\1?([^*_~]+)\1?\1/g, "$2"),
    );
  }

  return lines.join("\n");
}

export function buildReviewContextResponse(
  snapshot: ProjectContextSnapshot,
): ReviewContextResponse {
  return {
    text: markdownToPlainText(snapshot.markdown),
    markdown: snapshot.markdown,
    graph: snapshot.graph,
    meta: snapshot.meta,
  };
}

export function buildContextSnapshotView(snapshot: ReviewContextResponse): ContextSnapshotView {
  const { changedFiles, packages, root } = snapshot.graph;
  const previewLines = snapshot.text.split("\n");

  return {
    project: getProjectLabel(root),
    changedFileCount: changedFiles.length,
    additions: changedFiles.reduce((sum, file) => sum + file.additions, 0),
    deletions: changedFiles.reduce((sum, file) => sum + file.deletions, 0),
    packageCount: packages.length,
    charCount: snapshot.meta.charCount,
    previewLines: previewLines.slice(0, CONTEXT_PREVIEW_LINE_COUNT),
    previewTruncated: previewLines.length > CONTEXT_PREVIEW_LINE_COUNT,
  };
}
