"use client";

import { Children, isValidElement, useId, useMemo, type ComponentProps, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  CodeBlockProvider,
  type CodeBlockChrome,
  type CodeBlockVariant,
} from "./code-block-context";
import { CodeBlockLabel } from "./code-block-label";

export const codeBlockVariants = cva("", {
  variants: {
    variant: {
      hairline: "",
      bare: "",
      terminal: "",
    },
  },
  defaultVariants: {
    variant: "hairline",
  },
});

export interface CodeBlockProps
  extends VariantProps<typeof codeBlockVariants>,
    Omit<ComponentProps<"figure">, "children"> {
  language?: string;
  /**
   * Visible label for the block (filename or language). When rendered via
   * <CodeBlock.Label>, the same string is exposed as the accessible name via
   * aria-labelledby. Pass `label` if you do NOT render a Label inside the
   * header and want to set the accessible name from the root.
   */
  label?: string;
  /**
   * Decorative chrome rendered in the header strip.
   *   - "dots" — three desaturated terminal-style dots on the left edge.
   *   - "none" — no chrome decoration.
   * Defaults to "dots" for variant="terminal", "none" otherwise.
   */
  chrome?: CodeBlockChrome;
  children?: ComponentProps<"figure">["children"];
}

function containsLabelElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === CodeBlockLabel) return true;
    return containsLabelElement(child.props.children);
  });
}

/**
 * Accessible name precedence:
 *   aria-labelledby (consumer override)
 *   > aria-label (consumer override)
 *   > <CodeBlock.Label> rendered inside (matched via internal labelId)
 *   > `label` prop
 *   > `${language} code`
 *   > "Code block"
 */
export function CodeBlock({
  variant,
  language,
  label,
  chrome,
  className,
  children,
  ref,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: CodeBlockProps) {
  const resolvedVariant: CodeBlockVariant = variant ?? "hairline";
  const resolvedChrome: CodeBlockChrome = chrome ?? (resolvedVariant === "terminal" ? "dots" : "none");
  const labelId = useId();

  const fallbackName = label ?? (language ? `${language} code` : "Code block");
  const hasRenderableLabel = containsLabelElement(children);

  const contextValue = useMemo(
    () => ({ variant: resolvedVariant, chrome: resolvedChrome, labelId, language, fallbackName }),
    [resolvedVariant, resolvedChrome, labelId, language, fallbackName],
  );

  // Honour an explicit consumer override first. Otherwise: when a Label is
  // rendered inside, wire aria-labelledby to its id; when no Label is
  // rendered, use aria-label so we never emit a dangling labelledby id.
  let ariaProps: { "aria-label"?: string; "aria-labelledby"?: string };
  if (ariaLabel || ariaLabelledBy) {
    ariaProps = { "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy };
  } else if (hasRenderableLabel) {
    ariaProps = { "aria-labelledby": labelId };
  } else {
    ariaProps = { "aria-label": fallbackName };
  }

  return (
    <CodeBlockProvider value={contextValue}>
      <figure
        ref={ref}
        data-slot="code-block"
        data-variant={resolvedVariant}
        data-chrome={resolvedChrome}
        data-language={language}
        {...ariaProps}
        className={cn(codeBlockVariants({ variant: resolvedVariant }), className)}
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
