"use client";

import { type ComponentProps, useCallback, useMemo, useRef, useState } from "react";
import {
  type CodeBlockChrome,
  CodeBlockProvider,
  type CodeBlockVariant,
} from "./code-block-context";

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
  renderedLabelId: string | null,
  fallbackName: string,
): { "aria-label"?: string; "aria-labelledby"?: string } {
  if (props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined) {
    return {
      "aria-label": props["aria-label"],
      "aria-labelledby": props["aria-labelledby"],
    };
  }
  if (renderedLabelId) return { "aria-labelledby": renderedLabelId };
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
  const [renderedLabelId, setRenderedLabelId] = useState<string | null>(null);
  const labelRegistrationsRef = useRef(new Map<symbol, string>());

  const fallbackName = label ?? (language ? `${language} code` : "Code block");
  const ariaProps = resolveAriaName(props, renderedLabelId, fallbackName);

  const registerLabel = useCallback((id: string) => {
    const token = Symbol("code-block-label");
    const registrations = labelRegistrationsRef.current;
    registrations.set(token, id);
    setRenderedLabelId(registrations.values().next().value ?? null);

    return () => {
      registrations.delete(token);
      setRenderedLabelId(registrations.values().next().value ?? null);
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      variant: resolvedVariant,
      chrome: resolvedChrome,
      registerLabel,
      ariaLabel: ariaProps["aria-label"],
      ariaLabelledBy: ariaProps["aria-labelledby"],
    }),
    [
      resolvedVariant,
      resolvedChrome,
      registerLabel,
      ariaProps["aria-label"],
      ariaProps["aria-labelledby"],
    ],
  );

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
