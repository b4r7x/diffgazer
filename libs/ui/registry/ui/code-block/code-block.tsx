"use client";

import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  useId,
  useMemo,
} from "react";
import {
  type CodeBlockChrome,
  CodeBlockProvider,
  type CodeBlockVariant,
} from "./code-block-context";
import { CodeBlockLabel } from "./code-block-label";

function containsLabelElement(node: ReactNode): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    if (child.type === CodeBlockLabel) return true;
    const nested = (child.props as { children?: ReactNode }).children;
    if (nested && containsLabelElement(nested)) return true;
  }
  return false;
}

/** Props for code block. */
export interface CodeBlockProps extends Omit<ComponentProps<"figure">, "children"> {
  /**
   * Visual variant. "hairline" (default) is a soft-bordered block with a filename header.
   * "bare" removes chrome and renders a 2px left rule that turns accent on hover; the header is
   * suppressed. "terminal" centers the title in the header - use for shell output. Window dots
   * are controlled separately via the `chrome` prop and default to "dots" for
   * variant="terminal".
   */
  variant?: CodeBlockVariant;
  /**
   * Language identifier exposed as data-language and used in the default aria-label
   * ("{language} code").
   */
  language?: string;
  /**
   * Optional accessible name when no <CodeBlock.Label> is rendered. Falls back to "{language}
   * code" or "Code block".
   */
  label?: string;
  /**
   * Decorative chrome in the header strip. "dots" renders three desaturated terminal-style dots
   * on the left edge and reserves symmetric padding so a centered label stays balanced. "none"
   * disables chrome - useful for a terminal pane without window dots.
   */
  chrome?: CodeBlockChrome;
  /** Header and Content subparts. */
  children?: ComponentProps<"figure">["children"];
}

function resolveAriaName(
  props: { "aria-label"?: string; "aria-labelledby"?: string },
  children: ComponentProps<"figure">["children"],
  labelId: string,
  fallbackName: string,
): { "aria-label"?: string; "aria-labelledby"?: string } {
  if (props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined) return {};
  if (containsLabelElement(children)) return { "aria-labelledby": labelId };
  return { "aria-label": fallbackName };
}

/** Root <figure>. */
export function CodeBlock({
  variant,
  language,
  label,
  chrome,
  className,
  children,
  ref,
  ...props
}: CodeBlockProps) {
  const resolvedVariant: CodeBlockVariant = variant ?? "hairline";
  const resolvedChrome: CodeBlockChrome =
    chrome ?? (resolvedVariant === "terminal" ? "dots" : "none");
  const labelId = useId();

  const fallbackName = label ?? (language ? `${language} code` : "Code block");

  const hasLabel = containsLabelElement(children);

  const contextValue = useMemo(
    () => ({
      variant: resolvedVariant,
      chrome: resolvedChrome,
      labelId,
      hasLabel,
      language,
      fallbackName,
    }),
    [resolvedVariant, resolvedChrome, labelId, hasLabel, language, fallbackName],
  );

  const ariaProps = resolveAriaName(props, children, labelId, fallbackName);

  return (
    <CodeBlockProvider value={contextValue}>
      <figure
        ref={ref}
        data-slot="code-block"
        data-variant={resolvedVariant}
        data-chrome={resolvedChrome}
        data-language={language}
        className={className}
        {...ariaProps}
        {...props}
      >
        {resolvedChrome === "dots" ? (
          <span aria-hidden="true" data-slot="code-block-dots">
            <span />
            <span />
            <span />
          </span>
        ) : null}
        {children}
      </figure>
    </CodeBlockProvider>
  );
}
