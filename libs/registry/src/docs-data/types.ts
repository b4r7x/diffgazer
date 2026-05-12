export interface DocNote {
  title: string
  content: string
}

export interface ExampleRef {
  name: string
  title: string
}

export interface UsageSection {
  code?: string
  example?: string
  lang?: "tsx" | "typescript" | "css" | "bash" | "json" | "html"
}

export interface HookParameter {
  name: string
  type: string
  required: boolean
  description: string
  defaultValue?: string
}

export interface HookReturn {
  type: string
  description: string
  properties?: HookParameter[]
}

export interface HookDoc {
  description?: string
  usage?: UsageSection
  parameters?: HookParameter[]
  returns?: HookReturn
  notes?: DocNote[]
  examples?: ExampleRef[]
  tags?: string[]
}

export interface AnatomyNode {
  name: string
  indent: number
  note?: string
}

export interface ComponentNote {
  title: string
  content: string
}

export interface KeyboardSection {
  description: string
  examples: ExampleRef[]
}

export interface PropInfo {
  type: string
  required: boolean
  defaultValue: string | null
  description: string
}

export type ComponentPropsTable = Record<string, Record<string, PropInfo>>

export interface ComponentDoc {
  description?: string
  usage?: UsageSection
  notes?: ComponentNote[]
  examples?: ExampleRef[]
  anatomy?: AnatomyNode[]
  keyboard?: KeyboardSection | null
  tags?: string[]
  props?: ComponentPropsTable
}

/** @see libs/ui/registry/ui/code-block/code-block-line.tsx CodeBlockToken (extends with `className`) */
export interface CodeBlockToken {
  text: string
  color?: string
}

export interface CodeBlockLine {
  number: number
  content: CodeBlockToken[]
  type?: "highlight" | "added" | "removed"
}

export interface HookSourceData {
  name: string
  title: string
  description: string
  source: {
    raw: string
    highlighted: CodeBlockLine[]
  }
}

export type ConsumptionLibrary = "ui" | "keys"

export type ConsumptionItemKind = "component" | "hook" | "lib"

export interface ConsumptionPathOption {
  available: boolean
  command?: string
  note?: string
}

export interface ConsumptionMetadata {
  library: ConsumptionLibrary
  itemId: string
  itemKind: ConsumptionItemKind
  packageImport?: string
  copyPath?: string
  dgaddName: string
  publishGated: boolean
  paths: {
    copy: ConsumptionPathOption
    dgadd: ConsumptionPathOption
    package: ConsumptionPathOption
  }
  cssNote?: string
}

export interface EnrichedHookData extends HookSourceData {
  docs: HookDoc | null
  usageSnippet?: string
  usageSnippetHighlighted?: CodeBlockLine[]
  examples: string[]
  exampleSource: Record<string, { raw: string; highlighted: CodeBlockLine[] }>
  parameters?: HookParameter[]
  returns?: HookReturn
}
