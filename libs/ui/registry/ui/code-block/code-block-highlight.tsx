import { createElement, type ReactNode } from "react";
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

/** Root <figure>. */
export interface LowlightInstance {
  /** Highlights an item in lowlight instance. */
  highlight(language: string, value: string): HastRoot;
  /** highlight auto used by lowlight instance. */
  highlightAuto(value: string): HastRoot;
}

const MISSING_DEPENDENCY_MESSAGE =
  "@diffgazer/ui/components/code-block/highlight requires the optional peer dependency 'lowlight'. Install it with: npm install lowlight";

let lowlightPromise: Promise<LowlightInstance> | null = null;

/** Root <figure>. */
export function createDefaultLowlight(): Promise<LowlightInstance> {
  if (!lowlightPromise) {
    lowlightPromise = import("lowlight")
      .then((mod) => mod.createLowlight(mod.common) as LowlightInstance)
      .catch(() => {
        throw new Error(MISSING_DEPENDENCY_MESSAGE);
      });
  }
  return lowlightPromise;
}

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
  /** lowlight used by code block highlight. */
  lowlight?: LowlightInstance;
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

function highlightLine(
  source: string,
  language: string | undefined,
  lowlight: LowlightInstance | undefined,
): ReactNode {
  if (source.length === 0) return null;
  if (!lowlight) return source;
  try {
    const tree: HastRoot = language
      ? lowlight.highlight(language, source)
      : lowlight.highlightAuto(source);
    return tree.children.map((child, i) => renderNode(child, i));
  } catch {
    // lowlight throws when the language is unregistered; render plain text so
    // a typo'd language name never crashes the page.
    return source;
  }
}

/** Optional auto-colored content (subpath import; uses lowlight) */
export function CodeBlockHighlight({
  code,
  language,
  lineStates,
  lowlight,
  showLineNumbers = true,
  ...contentProps
}: CodeBlockHighlightProps) {
  const lines = code.split("\n");
  return (
    <CodeBlockContent showLineNumbers={showLineNumbers} {...contentProps}>
      {lines.map((line, i) => {
        const number = i + 1;
        return (
          <CodeBlockLine
            // biome-ignore lint/suspicious/noArrayIndexKey: code lines render in fixed source order and are never reordered; the line index is the stable identity (line content can repeat).
            key={i}
            number={showLineNumbers ? number : undefined}
            state={lineStates?.[number]}
          >
            {highlightLine(line, language, lowlight)}
          </CodeBlockLine>
        );
      })}
    </CodeBlockContent>
  );
}
