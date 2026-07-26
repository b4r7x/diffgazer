import type { ComponentDoc, PropInfo } from "@diffgazer/registry";
import type { CodeBlockLineProps } from "@diffgazer/ui/components/code-block";

export interface SourceFile {
  raw: string;
  highlighted: CodeBlockLineProps[];
}

export interface ComponentPageData {
  name: string;
  title: string;
  description: string;
  dependencies: string[];
  files: string[];
  props: Record<string, Record<string, PropInfo>>;
  usageSnippet: string;
  usageSnippetHighlighted: CodeBlockLineProps[];
  examples: string[];
  exampleSource: Record<string, SourceFile>;
  docs: ComponentDoc | null;
  crossDeps?: Array<{ library: string; type: string; items: string[] }>;
}

export interface ComponentSourceData {
  source: Record<string, SourceFile>;
  mergedSource: string;
  crossDeps?: ComponentPageData["crossDeps"];
}
