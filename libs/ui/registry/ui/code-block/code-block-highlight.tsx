"use client";

import { createElement, type ReactNode, useMemo } from "react";
import { CodeBlockContent, type CodeBlockContentProps } from "./code-block-content";
import { CodeBlockLine, type CodeBlockLineState } from "./code-block-line";

interface HastText {
  type: "text";
  value: string;
}
interface HastElement {
  type: "element";
  tagName: string;
  properties?: { className?: string | string[] | undefined } | undefined;
  children?: HastNode[] | undefined;
}
interface HastOther {
  type: "root" | "comment" | "doctype";
}
type HastNode = HastText | HastElement | HastOther;
interface HastRoot {
  type: "root";
  children: HastNode[];
}

export type LowlightInstance = {
  registered(language: string): boolean;
  highlight(language: string, value: string): HastRoot;
  highlightAuto(value: string): HastRoot;
};

export interface CodeBlockHighlightProps extends Omit<CodeBlockContentProps, "children"> {
  /** Source code to highlight. Each newline becomes a separate row. */
  code: string;
  /**
   * Language identifier consumed by lowlight (e.g. "ts", "tsx", "bash", "json"). Omit to use
   * lowlight's auto-detection.
   */
  language?: string;
  /**
   * Optional per-line state map keyed by 1-based line number. Applied to the underlying
   * CodeBlock.Line for each row.
   */
  lineStates?: Record<number, CodeBlockLineState>;
  /** Caller-created lowlight instance, with the desired language set registered. */
  lowlight: LowlightInstance;
}

function classListOf(node: HastElement): string | undefined {
  const className = node.properties?.className;
  if (!className) return undefined;
  if (typeof className === "string") return className;
  if (Array.isArray(className)) return className.join(" ");
  return undefined;
}

function renderNode(node: HastNode, key: number): ReactNode {
  if (node.type === "text") return node.value;
  if (node.type === "element") {
    const children = (node.children ?? []).map((child, i) => renderNode(child, i));
    return createElement(node.tagName, { key, className: classListOf(node) }, ...children);
  }
  return null;
}

function splitTextNode(node: HastText): HastNode[][] {
  return node.value.split("\n").map((value) => (value ? [{ ...node, value }] : []));
}

function splitElementNode(node: HastElement): HastNode[][] {
  return splitNodesByLine(node.children ?? []).map((children) =>
    children.length > 0 ? [{ ...node, children }] : [],
  );
}

function splitNodeByLine(node: HastNode): HastNode[][] {
  if (node.type === "text") return splitTextNode(node);
  if (node.type === "element") return splitElementNode(node);
  return [[node]];
}

function splitNodesByLine(nodes: HastNode[]): HastNode[][] {
  const lines: HastNode[][] = [[]];

  for (const node of nodes) {
    const nodeLines = splitNodeByLine(node);
    const firstLine = nodeLines[0];
    if (firstLine) {
      lines[lines.length - 1]?.push(...firstLine);
    }
    for (let i = 1; i < nodeLines.length; i += 1) {
      lines.push([...(nodeLines[i] ?? [])]);
    }
  }

  return lines;
}

function renderLineNodes(nodes: HastNode[] | undefined, fallback: string): ReactNode {
  if (!nodes || nodes.length === 0) return fallback.length > 0 ? fallback : null;
  return nodes.map((child, i) => renderNode(child, i));
}

function highlightTree(
  code: string,
  language: string | undefined,
  lowlight: LowlightInstance,
): HastRoot | null {
  if (!language) return lowlight.highlightAuto(code);
  // `registered` is the lowlight contract for this expected fallback. Keeping
  // the call outside a catch makes failures from a registered grammar visible
  // to the caller's error boundary instead of silently rendering plain text.
  if (!lowlight.registered(language)) return null;
  return lowlight.highlight(language, code);
}

function highlightCode(
  code: string,
  language: string | undefined,
  lowlight: LowlightInstance,
): ReactNode[] {
  const sourceLines = code.split("\n");
  const tree = highlightTree(code, language, lowlight);

  if (!tree) return sourceLines.map((line) => (line.length > 0 ? line : null));

  const highlightedLines = splitNodesByLine(tree.children);
  return sourceLines.map((line, i) => renderLineNodes(highlightedLines[i], line));
}

/** Runtime-highlighted content using a caller-owned lowlight instance. */
export function CodeBlockHighlight({
  code,
  language,
  lineStates,
  lowlight,
  showLineNumbers = true,
  ...contentProps
}: CodeBlockHighlightProps) {
  const highlightedLines = useMemo(
    () => highlightCode(code, language, lowlight),
    [code, language, lowlight],
  );

  return (
    <CodeBlockContent showLineNumbers={showLineNumbers} {...contentProps}>
      {highlightedLines.map((line, i) => {
        const number = i + 1;
        return (
          <CodeBlockLine
            // biome-ignore lint/suspicious/noArrayIndexKey: code lines render in fixed source order and are never reordered; the line index is the stable identity (line content can repeat).
            key={i}
            number={showLineNumbers ? number : undefined}
            state={lineStates?.[number]}
          >
            {line}
          </CodeBlockLine>
        );
      })}
    </CodeBlockContent>
  );
}
