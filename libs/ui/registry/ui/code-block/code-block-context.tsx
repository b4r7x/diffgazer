"use client";

import { createContext, useContext } from "react";

/** Allowed code block variant values. */
export type CodeBlockVariant = "hairline" | "bare" | "terminal";

/** Root <figure>. */
export type CodeBlockChrome = "dots" | "none";

/** Context value shared by code block. */
export interface CodeBlockContextValue {
  /**
   * Visual variant. "hairline" (default) is a soft-bordered block with a filename header.
   * "bare" removes chrome and renders a 2px left rule that turns accent on hover; the header is
   * suppressed. "terminal" centers the title in the header - use for shell output. Window dots
   * are controlled separately via the `chrome` prop and default to "dots" for
   * variant="terminal".
   */
  variant: CodeBlockVariant;
  /**
   * Decorative chrome in the header strip. "dots" renders three desaturated terminal-style dots
   * on the left edge and reserves symmetric padding so a centered label stays balanced. "none"
   * disables chrome - useful for a terminal pane without window dots.
   */
  chrome: CodeBlockChrome;
  /** DOM id for label. */
  labelId: string;
  /** Whether code block has label. */
  hasLabel: boolean;
  /**
   * Language identifier exposed as data-language and used in the default aria-label
   * ("{language} code").
   */
  language: string | undefined;
  /** fallback name used by code block. */
  fallbackName: string;
}

const CodeBlockContext = createContext<CodeBlockContextValue | null>(null);

/** Root <figure>. */
export const CodeBlockProvider = CodeBlockContext.Provider;

/** Reads the required code block context. */
export function useRequiredCodeBlockContext(consumerName: string): CodeBlockContextValue {
  const context = useContext(CodeBlockContext);
  if (!context) {
    throw new Error(`${consumerName} must be used inside <CodeBlock>`);
  }
  return context;
}
