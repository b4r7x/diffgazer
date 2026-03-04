import type { CodeBlockLineProps } from "@/components/ui/code-block"
import type { ExampleRef, AnatomyNode, ComponentNote, KeyboardSection, ComponentDoc } from "../../registry/component-docs/types"

export type { ExampleRef, AnatomyNode, ComponentNote, KeyboardSection, ComponentDoc }

export interface PropInfo {
  type: string
  required: boolean
  defaultValue: string | null
  description: string
}

export interface SourceFile {
  raw: string
  highlighted: CodeBlockLineProps[]
}

export interface ComponentData {
  name: string
  title: string
  description: string
  dependencies: string[]
  files: string[]
  props: Record<string, Record<string, PropInfo>>
  source: Record<string, SourceFile>
  mergedSource: string
  mergedSourceHighlighted: CodeBlockLineProps[]
  usageSnippet: string
  usageSnippetHighlighted: CodeBlockLineProps[]
  examples: string[]
  exampleSource: Record<string, SourceFile>
  docs: ComponentDoc | null
}

export type DocsData = Record<string, ComponentData>
