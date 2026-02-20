import type { CodeBlockLine } from "@/components/ui/code-block/code-block"
import type { ExampleRef, AnatomyNode, ComponentNote, KeyboardSection, ComponentDoc } from "../../vendor/registry/component-docs/types"

export type { ExampleRef, AnatomyNode, ComponentNote, KeyboardSection, ComponentDoc }

export interface PropInfo {
  type: string
  required: boolean
  defaultValue: string | null
  description: string
}

export interface SourceFile {
  raw: string
  highlighted: CodeBlockLine[]
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
  mergedSourceHighlighted: CodeBlockLine[]
  usageSnippet: string
  usageSnippetHighlighted: CodeBlockLine[]
  examples: string[]
  exampleSource: Record<string, SourceFile>
  docs: ComponentDoc | null
}

export type DocsData = Record<string, ComponentData>
