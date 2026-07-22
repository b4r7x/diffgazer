import type { EvidenceRef } from "@diffgazer/core/schemas/review";
import { CodeBlock, type CodeBlockLineState } from "@diffgazer/ui/components/code-block";
import { DiffView, parseDiff } from "@diffgazer/ui/components/diff-view";

function canRenderStructuredPatch(patch: string) {
  const files = parseDiff(patch);
  if (files.length !== 1) return false;
  const [file] = files;
  return file !== undefined && file.hunks.length > 0;
}

function getPatchLineState(line: string): CodeBlockLineState | undefined {
  if (line.startsWith("+") && !line.startsWith("+++")) return "added";
  if (line.startsWith("-") && !line.startsWith("---")) return "removed";
  return undefined;
}

const DIFF_MARKER_RE = /^(\+|-|@@)/m;

function getPlainSnippetBeforeSide(patch: string, targetFile: string, evidence: EvidenceRef[]) {
  const patchLines = new Set(patch.split(/\r?\n/).filter((line) => line.length > 0));
  return evidence
    .filter(
      (item): item is EvidenceRef & { type: "code"; file: string } =>
        item.type === "code" && item.file === targetFile && item.excerpt.length > 0,
    )
    .map((item) => item.excerpt)
    .find((excerpt) => excerpt.split(/\r?\n/).some((line) => patchLines.has(line)));
}

export function PatchTabContent({
  patch,
  targetFile,
  evidence,
}: {
  patch: string;
  targetFile: string;
  evidence: EvidenceRef[];
}) {
  if (canRenderStructuredPatch(patch)) {
    return <DiffView patch={patch} label="Suggested patch" />;
  }

  if (!DIFF_MARKER_RE.test(patch)) {
    const original = getPlainSnippetBeforeSide(patch, targetFile, evidence);
    if (original) {
      return <DiffView before={original} after={patch} label="Suggested patch" />;
    }
  }

  return (
    <CodeBlock label="Suggested patch">
      <CodeBlock.Content tabIndex={-1}>
        {patch.split("\n").map((line, index) => (
          <CodeBlock.Line
            key={`${index}-${line}`}
            number={index + 1}
            content={line}
            state={getPatchLineState(line)}
          />
        ))}
      </CodeBlock.Content>
    </CodeBlock>
  );
}
