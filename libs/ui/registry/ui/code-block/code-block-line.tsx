import type { ComponentProps, ReactNode } from "react";

export interface CodeBlockToken {
  text: string;
  color?: string;
  className?: string;
}

export type CodeBlockLineState = "highlight" | "added" | "removed";

export interface CodeBlockLineProps extends Omit<ComponentProps<"span">, "content" | "children"> {
  number?: number;
  content?: string | CodeBlockToken[];
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
    // biome-ignore lint/suspicious/noArrayIndexKey: syntax tokens render in fixed left-to-right order within a line and are never reordered; the token index is the stable identity.
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
