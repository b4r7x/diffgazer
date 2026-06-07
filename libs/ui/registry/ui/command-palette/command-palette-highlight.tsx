"use client";

import { Children, type ReactNode } from "react";
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

export function matchPositions(value: string, search: string): number[] {
  if (!search) return [];
  const lowerValue = value.toLowerCase();
  const lowerSearch = search.toLowerCase();
  const contiguous = lowerValue.indexOf(lowerSearch);
  if (contiguous !== -1) {
    return Array.from({ length: lowerSearch.length }, (_, i) => contiguous + i);
  }
  const positions: number[] = [];
  let cursor = 0;
  for (const char of lowerSearch) {
    const index = lowerValue.indexOf(char, cursor);
    if (index === -1) return [];
    positions.push(index);
    cursor = index + 1;
  }
  return positions;
}

function renderWithMatches(value: string, search: string): ReactNode {
  const positions = matchPositions(value, search);
  if (positions.length === 0) return value;
  const set = new Set(positions);
  const nodes: ReactNode[] = [];
  for (let i = 0; i < value.length; i++) {
    const char = value[i] ?? "";
    if (set.has(i)) {
      nodes.push(
        <mark key={i} data-slot="command-palette-item-match">
          {char}
        </mark>,
      );
    } else {
      nodes.push(char);
    }
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
  tone?: CommandPaletteItemTone;
  label?: string;
}

export function CommandPaletteHighlightItem({
  tone,
  value,
  label,
  children,
  ...rest
}: CommandPaletteHighlightItemProps) {
  const { search } = useCommandPaletteContext();
  const renderedChildren = children ?? label;
  const childrenIsPureText = children !== undefined && isPureText(children);
  const labelText = label ?? (childrenIsPureText ? extractText(children) : "");
  const searchValue = value ?? labelText;
  const resolvedTone = tone ?? categorize(labelText);
  return (
    <CommandPaletteItem {...rest} value={searchValue} tone={resolvedTone}>
      {childrenIsPureText && search
        ? renderWithMatches(extractText(children), search)
        : renderedChildren}
    </CommandPaletteItem>
  );
}
