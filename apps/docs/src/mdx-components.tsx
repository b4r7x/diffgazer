import type { MDXComponents } from "mdx/types";
import { lazy } from "react";
import { DiffgazerPreview } from "@/components/diffgazer-preview";
import { AccessibilityNotes } from "@/components/docs-mdx/blocks/accessibility-notes";
import { APIReference } from "@/components/docs-mdx/blocks/api-reference";
import { ConsumptionBlock } from "@/components/docs-mdx/blocks/consumption";
import { Example } from "@/components/docs-mdx/blocks/example";
import { Examples } from "@/components/docs-mdx/blocks/examples";
import { KeyboardNav } from "@/components/docs-mdx/blocks/keyboard-nav";
import { Notes } from "@/components/docs-mdx/blocks/notes";
import { ParameterTableBlock } from "@/components/docs-mdx/blocks/parameter-table-block";
import { PropsTableBlock } from "@/components/docs-mdx/blocks/props-table-block";
import { ReturnsTable } from "@/components/docs-mdx/blocks/returns-table";
import { SourceViewerBlock } from "@/components/docs-mdx/blocks/source-viewer-block";
import { Step, Steps } from "@/components/docs-mdx/blocks/steps";
import { UsageSnippet } from "@/components/docs-mdx/blocks/usage-snippet";
import { markdownMdxComponents } from "@/components/docs-mdx/markdown-renderers";
import { ComponentDocScaffold, HookDocScaffold } from "@/components/docs-mdx/scaffolds";
import { ColorGrid } from "@/features/theme/components/color-grid";
import { ThemePlayground } from "@/features/theme/components/playground";
import { VariableDiagram } from "@/features/theme/components/variable-diagram";

const LibraryHookSource = lazy(() =>
  import("@/components/hook-source").then((module) => ({ default: module.LibraryHookSource })),
);

const mdxComponents: MDXComponents = {
  ...markdownMdxComponents,
  ThemePlayground,
  VariableDiagram,
  ColorGrid,
  DiffgazerPreview,
  LibraryHookSource,
  Example,
  Examples,
  PropsTable: PropsTableBlock,
  ParameterTable: ParameterTableBlock,
  ReturnsTable,
  UsageSnippet,
  SourceViewer: SourceViewerBlock,
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
