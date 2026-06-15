import type { MDXComponents } from "mdx/types";
import { AccessibilityNotes } from "@/components/docs-mdx/blocks/accessibility-notes";
import { APIReference } from "@/components/docs-mdx/blocks/api-reference";
import { ConsumptionBlock } from "@/components/docs-mdx/blocks/consumption";
import { Example } from "@/components/docs-mdx/blocks/example";
import { Examples } from "@/components/docs-mdx/blocks/examples";
import { KeyboardNav } from "@/components/docs-mdx/blocks/keyboard-nav";
import { Notes } from "@/components/docs-mdx/blocks/notes";
import { ParameterTableBlock as ParameterTable } from "@/components/docs-mdx/blocks/parameter-table";
import { PropsTableBlock as PropsTable } from "@/components/docs-mdx/blocks/props-table";
import { ReturnsTable } from "@/components/docs-mdx/blocks/returns-table";
import { SourceViewerBlock as SourceViewer } from "@/components/docs-mdx/blocks/source-viewer";
import { Step, Steps } from "@/components/docs-mdx/blocks/steps";
import { UsageSnippet } from "@/components/docs-mdx/blocks/usage-snippet";
import { markdownMdxComponents } from "@/components/docs-mdx/markdown-renderers";
import { ComponentDocScaffold, HookDocScaffold } from "@/components/docs-mdx/scaffolds";
import { HookSource, LibraryHookSource } from "@/components/hook-source";
import { ColorGrid } from "@/features/theme/components/color-grid";
import { DiffgazerPreview } from "@/features/theme/components/diffgazer-preview";
import { ThemePlayground } from "@/features/theme/components/playground";
import { VariableDiagram } from "@/features/theme/components/variable-diagram";

const mdxComponents: MDXComponents = {
  ...markdownMdxComponents,
  ThemePlayground,
  VariableDiagram,
  ColorGrid,
  DiffgazerPreview,
  HookSource,
  LibraryHookSource,
  Example,
  Examples,
  PropsTable,
  ParameterTable,
  ReturnsTable,
  UsageSnippet,
  SourceViewer,
  Steps,
  Step,
  KeyboardNav,
  AccessibilityNotes,
  Notes,
  ConsumptionBlock,
  APIReference,
  ComponentDocScaffold,
  HookDocScaffold,
};

export function useMDXComponents(): MDXComponents {
  return mdxComponents;
}
