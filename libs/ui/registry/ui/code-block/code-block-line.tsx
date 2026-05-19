"use client";

import type { ComponentProps, ReactNode } from "react";

/**
 * Token shape shared with @diffgazer/registry docs-data CodeBlockToken
 * (registry-side producers omit `className`; both shapes are structurally
 * compatible).
 */
export interface CodeBlockToken {
  text: string;
  /** Inline CSS color; consumer-trusted — only pass values you control. */
  color?: string;
  className?: string;
}

export type CodeBlockLineState = "highlight" | "added" | "removed";

export interface CodeBlockLineProps extends Omit<ComponentProps<"span">, "content" | "children"> {
  number?: number;
  /** Plain text or a token array for inline-styled output. Ignored if `children` is provided. */
  content?: string | CodeBlockToken[];
  /** Pre-rendered line body. Takes precedence over `content`; the consumer renders inside <code>. */
  children?: ReactNode;
  state?: CodeBlockLineState;
}

const NON_BREAKING_SPACE = " ";

function signCharacter(state: CodeBlockLineState | undefined): string {
  if (state === "added") return "+";
  if (state === "removed") return "−";
  return NON_BREAKING_SPACE;
}

function renderContent(content: string | CodeBlockToken[] | undefined): ReactNode {
  if (content == null) return null;
  if (typeof content === "string") return content;
  return content.map((token, i) => (
    <span key={i} style={{ color: token.color }} className={token.className}>
      {token.text}
    </span>
  ));
}

export function CodeBlockLine({
  number,
  content,
  children,
  state,
  className,
  ref,
  ...props
}: CodeBlockLineProps) {
  const isDiffLine = state === "added" || state === "removed";
  return (
    <span
      ref={ref}
      data-slot="code-block-line"
      data-line-state={state}
      className={className}
      {...props}
    >
      {number != null ? (
        <span aria-hidden="true" data-slot="code-block-line-number">
          {number}
        </span>
      ) : null}
      <span aria-hidden="true" data-slot="code-block-line-sign">
        {signCharacter(state)}
      </span>
      {isDiffLine ? (
        <span className="sr-only">{state === "added" ? "Added: " : "Removed: "}</span>
      ) : null}
      <code>{children ?? renderContent(content)}</code>
    </span>
  );
}
