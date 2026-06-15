import type { ComponentProps, ReactNode } from "react";

/** Root <figure>. */
export interface CodeBlockToken {
  /** Text content. */
  text: string;
  /** Color token. */
  color?: string;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Allowed code block line state values. */
export type CodeBlockLineState = "highlight" | "added" | "removed";

/** Props for code block line. */
export interface CodeBlockLineProps extends Omit<ComponentProps<"span">, "content" | "children"> {
  /** Line number rendered in the gutter. Omit to hide the gutter for this line. */
  number?: number;
  /**
   * Line content. Either a plain string or an array of tokens for syntax coloring. Ignored when
   * `children` is provided.
   */
  content?: string | CodeBlockToken[];
  /**
   * Pre-rendered line body (e.g. highlighted React elements). Takes precedence over `content`
   * and renders inside the <code> element.
   */
  children?: ReactNode;
  /**
   * Per-line visual state. "highlight" tints the row; "added"/"removed" render gutter sign
   * characters (+/−), color tint, and an sr-only "Added: "/"Removed: " prefix for assistive
   * tech.
   */
  state?: CodeBlockLineState;
  /** Screen-reader prefix for an added diff line. Defaults to "Added: ". */
  addedLineLabel?: string;
  /** Screen-reader prefix for a removed diff line. Defaults to "Removed: ". */
  removedLineLabel?: string;
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

/** Single line with optional gutter, diff state, and token coloring. */
export function CodeBlockLine({
  number,
  content,
  children,
  state,
  className,
  addedLineLabel = "Added: ",
  removedLineLabel = "Removed: ",
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
        <span className="sr-only">{state === "added" ? addedLineLabel : removedLineLabel}</span>
      ) : null}
      <code>{children ?? renderContent(content)}</code>
    </span>
  );
}
