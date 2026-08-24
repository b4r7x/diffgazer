import type { EvidenceRef } from "@diffgazer/core/schemas/review";
import { CodeBlock, type CodeBlockLineState } from "@diffgazer/ui/components/code-block";
import { DiffView, type ParsedDiff, parseDiff } from "@diffgazer/ui/components/diff-view";

/**
 * The focusable rows region DiffView renders (unified or split). It advertises
 * j/k/Home/End but only receives them once focused, so the details keyboard
 * hook Enter-focuses it through this selector.
 */
export const PATCH_DIFF_REGION_SELECTOR =
  '[data-slot="diff-view-rows"], [data-slot="diff-view-split"]';

/** The single structured file DiffView can render, or null when the patch is not one. */
function parseStructuredPatch(patch: string): ParsedDiff | null {
  const files = parseDiff(patch);
  if (files.length !== 1) return null;
  const [file] = files;
  return file && file.hunks.length > 0 ? file : null;
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

type PatchRendering =
  | { kind: "structured"; file: ParsedDiff }
  | { kind: "before-after"; before: string }
  | { kind: "plain" };

function resolvePatchRendering(
  patch: string,
  targetFile: string,
  evidence: EvidenceRef[],
): PatchRendering {
  const structured = parseStructuredPatch(patch);
  if (structured) return { kind: "structured", file: structured };
  if (!DIFF_MARKER_RE.test(patch)) {
    const before = getPlainSnippetBeforeSide(patch, targetFile, evidence);
    if (before) return { kind: "before-after", before };
  }
  return { kind: "plain" };
}

/**
 * Whether the patch tab renders the focusable DiffView region rather than the
 * plain CodeBlock fallback, so keyboard hints only advertise Enter when the
 * diff region exists to receive it.
 */
export function patchRendersDiffView(
  patch: string,
  targetFile: string,
  evidence: EvidenceRef[],
): boolean {
  return resolvePatchRendering(patch, targetFile, evidence).kind !== "plain";
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
  const rendering = resolvePatchRendering(patch, targetFile, evidence);
  if (rendering.kind === "structured") {
    return <DiffView diff={rendering.file} label="Suggested patch" />;
  }

  if (rendering.kind === "before-after") {
    return <DiffView before={rendering.before} after={patch} label="Suggested patch" />;
  }

  // The fallback catches whatever the model wrote when it is not a parseable
  // patch — often a paragraph of prose.
  return (
    <CodeBlock label="Suggested patch">
      <CodeBlock.Content wrap>
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
