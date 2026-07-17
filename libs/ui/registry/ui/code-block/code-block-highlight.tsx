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
type HastNode = HastText | HastElement | { type: string };
interface HastRoot {
  type: "root";
  children: HastNode[];
}

type LowlightAuto = {
  [K in `highlight${"Auto"}`]: (value: string) => HastRoot;
};

export type LowlightInstance = {
  highlight(language: string, value: string): HastRoot;
} & LowlightAuto;

/** Props for code block highlight. */
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
  if (node.type === "text") return (node as HastText).value;
  if (node.type === "element") {
    const el = node as HastElement;
    const children = (el.children ?? []).map((child, i) => renderNode(child, i));
    return createElement(el.tagName, { key, className: classListOf(el) }, ...children);
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
  if (node.type === "text") return splitTextNode(node as HastText);
  if (node.type === "element") return splitElementNode(node as HastElement);
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

function highlightCode(
  code: string,
  language: string | undefined,
  lowlight: LowlightInstance,
): ReactNode[] {
  const sourceLines = code.split("\n");

  try {
    const tree: HastRoot = language
      ? lowlight.highlight(language, code)
      : lowlight.highlightAuto(code);
    const highlightedLines = splitNodesByLine(tree.children);
    return sourceLines.map((line, i) => renderLineNodes(highlightedLines[i], line));
  } catch {
    // lowlight throws when the language is unregistered; render plain text so
    // a typo'd language name never crashes the page.
    return sourceLines.map((line) => (line.length > 0 ? line : null));
  }
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
  const lines = code.split("\n");
  const highlightedLines = useMemo(
    () => highlightCode(code, language, lowlight),
    [code, language, lowlight],
  );

  return (
    <CodeBlockContent showLineNumbers={showLineNumbers} {...contentProps}>
      {lines.map((_, i) => {
        const number = i + 1;
        return (
          <CodeBlockLine
            // biome-ignore lint/suspicious/noArrayIndexKey: code lines render in fixed source order and are never reordered; the line index is the stable identity (line content can repeat).
            key={i}
            number={showLineNumbers ? number : undefined}
            state={lineStates?.[number]}
          >
            {highlightedLines[i]}
          </CodeBlockLine>
        );
      })}
    </CodeBlockContent>
  );
}
