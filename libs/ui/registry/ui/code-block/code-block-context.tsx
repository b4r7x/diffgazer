"use client";

import { createContext, useContext } from "react";

export type CodeBlockVariant = "hairline" | "bare" | "terminal";

export type CodeBlockChrome = "dots" | "none";

export interface CodeBlockContextValue {
  variant: CodeBlockVariant;
  chrome: CodeBlockChrome;
  labelId: string;
  hasLabel: boolean;
  language: string | undefined;
  fallbackName: string;
}

const CodeBlockContext = createContext<CodeBlockContextValue | null>(null);

export const CodeBlockProvider = CodeBlockContext.Provider;

export function useRequiredCodeBlockContext(consumerName: string): CodeBlockContextValue {
  const context = useContext(CodeBlockContext);
  if (!context) {
    throw new Error(`${consumerName} must be used inside <CodeBlock>`);
  }
  return context;
}
