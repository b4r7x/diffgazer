"use client";

import { createContext, useContext } from "react";

/** Allowed code block variant values. */
export type CodeBlockVariant = "hairline" | "bare" | "terminal";

/** Decorative header chrome options. */
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
  /** Registers the id of a label that actually rendered. */
  registerLabel: (id: string) => () => void;
  /** Resolved accessible label for the code block. */
  ariaLabel: string | undefined;
  ariaLabelledBy: string | undefined;
}

const CodeBlockContext = createContext<CodeBlockContextValue | null>(null);

export const CodeBlockProvider = CodeBlockContext.Provider;

/** Reads the required code block context. */
export function useRequiredCodeBlockContext(consumerName: string): CodeBlockContextValue {
  const context = useContext(CodeBlockContext);
  if (!context) {
    throw new Error(`${consumerName} must be used inside <CodeBlock>`);
  }
  return context;
}
