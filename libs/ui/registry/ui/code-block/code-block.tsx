"use client";

import { Children, isValidElement, useId, useMemo, type ComponentProps, type ReactNode } from "react";
import { CodeBlockLabel } from "./code-block-label";
import {
  CodeBlockProvider,
  type CodeBlockChrome,
  type CodeBlockVariant,
} from "./code-block-context";

function containsLabelElement(node: ReactNode): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    if (child.type === CodeBlockLabel) return true;
    const nested = (child.props as { children?: ReactNode }).children;
    if (nested && containsLabelElement(nested)) return true;
  }
  return false;
}

export interface CodeBlockProps extends Omit<ComponentProps<"figure">, "children"> {
  variant?: CodeBlockVariant;
  language?: string;
  label?: string;
  chrome?: CodeBlockChrome;
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
  const resolvedChrome: CodeBlockChrome = chrome ?? (resolvedVariant === "terminal" ? "dots" : "none");
  const labelId = useId();

  const fallbackName = label ?? (language ? `${language} code` : "Code block");

  const hasLabel = containsLabelElement(children);

  const contextValue = useMemo(
    () => ({ variant: resolvedVariant, chrome: resolvedChrome, labelId, hasLabel, language, fallbackName }),
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
