"use client";

import { Children, type ReactNode } from "react";
import { foldSearchValue } from "@/lib/search";
import { useCommandPaletteContext } from "./command-palette-context";
import {
  CommandPaletteItem,
  type CommandPaletteItemProps,
  type CommandPaletteItemTone,
} from "./command-palette-item";

const TONE_RULES: ReadonlyArray<readonly [RegExp, CommandPaletteItemTone]> = [
  [/^(delete|remove|reset|drop|destroy|log\s*out|sign\s*out)\b/i, "destructive"],
  [/^(go to|open|jump|navigate|switch|view)\b/i, "nav"],
  [/^(toggle|enable|disable|set|configure|preferences|settings)\b/i, "settings"],
  [/^(ask|generate|summari[sz]e|explain|chat|ai)\b/i, "ai"],
  [/^(run|exec|build|test|deploy|create|new|add|export|import|copy)\b/i, "action"],
];

export function categorize(value: string): CommandPaletteItemTone {
  const trimmed = value.trim();
  for (const [pattern, tone] of TONE_RULES) {
    if (pattern.test(trimmed)) return tone;
  }
  return "neutral";
}

// Grapheme clusters, not code points: a <mark> boundary must never split a
// surrogate pair or detach a combining mark from its base letter. Array.from
// is the code-point fallback where Intl.Segmenter is unavailable.
const graphemeSegmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function splitGraphemes(value: string): string[] {
  if (!graphemeSegmenter) return Array.from(value);
  return Array.from(graphemeSegmenter.segment(value), (segment) => segment.segment);
}

function buildFoldIndexMap(graphemes: readonly string[]): { folded: string; indexMap: number[] } {
  const indexMap: number[] = [];
  let folded = "";
  for (let i = 0; i < graphemes.length; i++) {
    const foldedGrapheme = foldSearchValue(graphemes[i] ?? "");
    for (let j = 0; j < foldedGrapheme.length; j++) {
      indexMap.push(i);
    }
    folded += foldedGrapheme;
  }
  return { folded, indexMap };
}

export function matchPositions(value: string, search: string): number[] {
  if (!search) return [];
  const graphemes = splitGraphemes(value);
  const { folded: foldedValue, indexMap } = buildFoldIndexMap(graphemes);
  const foldedSearch = foldSearchValue(search);
  const contiguous = foldedValue.indexOf(foldedSearch);
  if (contiguous !== -1) {
    const positions = new Set<number>();
    for (let i = contiguous; i < contiguous + foldedSearch.length; i++) {
      positions.add(indexMap[i] ?? 0);
    }
    return [...positions].sort((a, b) => a - b);
  }
  const positions: number[] = [];
  let cursor = 0;
  for (const char of foldedSearch) {
    const index = foldedValue.indexOf(char, cursor);
    if (index === -1) return [];
    positions.push(indexMap[index] ?? 0);
    cursor = index + 1;
  }
  return positions;
}

function renderWithMatches(value: string, search: string): ReactNode {
  const graphemes = splitGraphemes(value);
  const positions = matchPositions(value, search);
  if (positions.length === 0) return value;
  const set = new Set(positions);
  const nodes: ReactNode[] = [];
  let index = 0;
  // Emit one node per run, not per grapheme: labels re-render on every keystroke,
  // and adjacent single-character marks are announced once each by screen readers.
  while (index < graphemes.length) {
    const isMatch = set.has(index);
    let end = index;
    while (end < graphemes.length && set.has(end) === isMatch) end++;
    const run = graphemes.slice(index, end).join("");
    if (isMatch) {
      nodes.push(
        <mark key={index} data-slot="command-palette-item-match">
          {run}
        </mark>,
      );
    } else {
      nodes.push(run);
    }
    index = end;
  }
  return nodes;
}

function extractText(children: ReactNode): string {
  let text = "";
  Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      text += String(child);
    }
  });
  return text;
}

// Children are highlight-safe when extractText recovers the full descendant
// text — i.e. nothing was dropped by skipping non-string nodes. For mixed
// content (icons, <strong>, etc.) we must render children untouched to avoid
// silent content loss.
function isPureText(children: ReactNode): boolean {
  if (typeof children === "string" || typeof children === "number") return true;
  if (Array.isArray(children)) return children.every(isPureText);
  return false;
}

export interface CommandPaletteHighlightItemProps extends Omit<CommandPaletteItemProps, "tone"> {
  /** Visual tone. */
  tone?: CommandPaletteItemTone;
  /** Accessible label text. */
  label?: string;
}

export function CommandPaletteHighlightItem({
  tone,
  value,
  label,
  children,
  "aria-label": ariaLabel,
  ...rest
}: CommandPaletteHighlightItemProps) {
  const { search } = useCommandPaletteContext();
  const renderedChildren = children ?? label;
  const childrenIsPureText = children !== undefined && isPureText(children);
  const labelText = label ?? (childrenIsPureText ? extractText(children) : undefined);
  const searchValue = value ?? (labelText || undefined);
  const resolvedTone = tone ?? categorize(labelText ?? "");
  return (
    <CommandPaletteItem
      {...rest}
      value={searchValue}
      tone={resolvedTone}
      aria-label={ariaLabel ?? label}
    >
      {childrenIsPureText && search
        ? renderWithMatches(extractText(children), search)
        : renderedChildren}
    </CommandPaletteItem>
  );
}
