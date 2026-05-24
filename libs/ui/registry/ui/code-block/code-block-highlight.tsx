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

export interface LowlightInstance {
  highlight(language: string, value: string): HastRoot;
  highlightAuto(value: string): HastRoot;
}

const MISSING_DEPENDENCY_MESSAGE =
  "@diffgazer/ui/components/code-block/highlight requires the optional peer dependency 'lowlight'. Install it with: npm install lowlight";

let lowlightPromise: Promise<LowlightInstance> | null = null;

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

export interface CodeBlockHighlightProps extends Omit<CodeBlockContentProps, "children"> {
  code: string;
  language?: string;
  lineStates?: Record<number, CodeBlockLineState>;
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
