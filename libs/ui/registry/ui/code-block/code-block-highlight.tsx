import { createElement, type ReactNode } from "react";
import type { Element, Root } from "hast";
import { common, createLowlight } from "lowlight";
import { CodeBlockContent, type CodeBlockContentProps } from "./code-block-content";
import { CodeBlockLine, type CodeBlockLineState } from "./code-block-line";

export interface CodeBlockHighlightProps extends Omit<CodeBlockContentProps, "children"> {
  /** Source code to highlight. Each newline becomes a separate row. */
  code: string;
  /** Language identifier (any name lowlight's `common` bundle supports). */
  language?: string;
  /** Optional diff/highlight state per 1-based line number. */
  lineStates?: Record<number, CodeBlockLineState>;
}

type Lowlight = ReturnType<typeof createLowlight>;
// Module-cached: build the highlighter once per process. `common` is the only
// preset registered today — extend via a `registerLanguage(name, fn)` helper if
// needed. Safe across RSC server/client runtimes because the registration is
// pure and idempotent (no shared mutable state beyond this cache itself).
let cachedInstance: Lowlight | null = null;

function getLowlight(): Lowlight {
  if (cachedInstance) return cachedInstance;
  cachedInstance = createLowlight(common);
  return cachedInstance;
}

function classListOf(node: Element): string | undefined {
  const className = node.properties?.className;
  if (!className) return undefined;
  if (typeof className === "string") return className;
  if (Array.isArray(className)) return className.join(" ");
  return undefined;
}

function renderNode(node: Root["children"][number], key: number): ReactNode {
  if (node.type === "text") return node.value;
  if (node.type === "element") {
    const children = (node.children ?? []).map((child, i) => renderNode(child, i));
    return createElement(node.tagName, { key, className: classListOf(node) }, ...children);
  }
  return null;
}

function highlightLine(source: string, language: string | undefined): ReactNode {
  if (source.length === 0) return null;
  const lowlight = getLowlight();
  try {
    const tree: Root = language
      ? lowlight.highlight(language, source)
      : lowlight.highlightAuto(source);
    return tree.children.map((child, i) => renderNode(child, i));
  } catch {
    // lowlight throws when the language is unregistered; render plain text so
    // a typo'd language name never crashes the page.
    return source;
  }
}

export function CodeBlockHighlight({
  code,
  language,
  lineStates,
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
            key={i}
            number={showLineNumbers ? number : undefined}
            state={lineStates?.[number]}
          >
            {highlightLine(line, language)}
          </CodeBlockLine>
        );
      })}
    </CodeBlockContent>
  );
}
