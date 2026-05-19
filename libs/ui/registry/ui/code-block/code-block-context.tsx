"use client";

import { createContext, useContext } from "react";

export type CodeBlockVariant = "hairline" | "bare" | "terminal";

export type CodeBlockChrome = "dots" | "none";

export interface CodeBlockContextValue {
  variant: CodeBlockVariant;
  chrome: CodeBlockChrome;
  labelId: string;
  language: string | undefined;
  /**
   * Fallback accessible name used by descendants (CodeBlock.Content) when
   * no <CodeBlock.Label> is rendered and the consumer did not pass an
   * explicit aria-label/aria-labelledby. Resolves to the figure's effective
   * name (label prop / "{language} code" / "Code block").
   */
  fallbackName: string;
}

const CodeBlockContext = createContext<CodeBlockContextValue | null>(null);

export const CodeBlockProvider = CodeBlockContext.Provider;

export function useCodeBlockContext(): CodeBlockContextValue | null {
  return useContext(CodeBlockContext);
}

export function useRequiredCodeBlockContext(consumerName: string): CodeBlockContextValue {
  const context = useContext(CodeBlockContext);
  if (!context) {
    throw new Error(`${consumerName} must be used inside <CodeBlock>`);
  }
  return context;
}
