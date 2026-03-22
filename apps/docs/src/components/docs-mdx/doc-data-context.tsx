"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { ComponentData } from "@/types/docs-data"
import type { CodeBlockLineProps } from "@/components/ui/code-block"

export interface HookData {
  name: string
  title: string
  description: string
  source: { raw: string; highlighted: CodeBlockLineProps[] }
  docs: {
    description?: string
    usage?: { code?: string; example?: string; lang?: string }
    parameters?: Array<{ name: string; type: string; required: boolean; description: string; defaultValue?: string }>
    returns?: {
      type: string
      description: string
      properties?: Array<{ name: string; type: string; required: boolean; description: string; defaultValue?: string }>
    }
    notes?: Array<{ title: string; content: string }>
    examples?: Array<{ name: string; title: string }>
    tags?: string[]
  } | null
  usageSnippet?: string
  usageSnippetHighlighted?: CodeBlockLineProps[]
  examples: string[]
  exampleSource: Record<string, { raw: string; highlighted: CodeBlockLineProps[] }>
}

export type DocData =
  | { type: "component"; data: ComponentData }
  | { type: "hook"; data: HookData }

const DocDataContext = createContext<DocData | null>(null)

export function DocDataProvider({ value, children }: { value: DocData | null; children: ReactNode }) {
  return <DocDataContext.Provider value={value}>{children}</DocDataContext.Provider>
}

export function useDocData(): DocData | null {
  return useContext(DocDataContext)
}

export function useComponentData(): ComponentData | null {
  const ctx = useDocData()
  return ctx?.type === "component" ? ctx.data : null
}

export function useHookData(): HookData | null {
  const ctx = useDocData()
  return ctx?.type === "hook" ? ctx.data : null
}
