import type {
  AnatomyNode,
  ComponentDoc,
  ComponentNote,
  ComponentPropsTable,
  ExampleRef,
  KeyboardSection,
  PropInfo,
} from "@diffgazer/registry";
import type { CodeBlockLineProps } from "@diffgazer/ui/components/code-block";

export type {
  ExampleRef,
  AnatomyNode,
  ComponentNote,
  KeyboardSection,
  ComponentDoc,
  PropInfo,
  ComponentPropsTable,
};

export interface SourceFile {
  raw: string;
  highlighted: CodeBlockLineProps[];
}

export interface ComponentData {
  name: string;
  title: string;
  description: string;
  dependencies: string[];
  files: string[];
  props: Record<string, Record<string, PropInfo>>;
  source: Record<string, SourceFile>;
  mergedSource: string;
  mergedSourceHighlighted: CodeBlockLineProps[];
  usageSnippet: string;
  usageSnippetHighlighted: CodeBlockLineProps[];
  examples: string[];
  exampleSource: Record<string, SourceFile>;
  docs: ComponentDoc | null;
  crossDeps?: Array<{ library: string; type: string; items: string[] }>;
}

export type DocsData = Record<string, ComponentData>;
