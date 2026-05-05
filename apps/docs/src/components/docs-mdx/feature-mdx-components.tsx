import type { MDXComponents } from "mdx/types"
import { ColorGrid } from "@/features/theme/components/color-grid"
import { DiffgazerPreview } from "@/features/theme/components/diffgazer-preview"
import { ThemePlayground } from "@/features/theme/components/theme-playground"
import { VariableDiagram } from "@/features/theme/components/variable-diagram"
import { HookSource, LibraryHookSource } from "@/components/hook-source"
import {
  Example,
  Examples,
  PropsTable as PropsTableBlock,
  ParameterTable as ParameterTableBlock,
  ReturnsTable,
  UsageSnippet,
  InstallCommand,
  SourceViewer as SourceViewerBlock,
  KeyboardNav,
  AccessibilityNotes,
  Notes,
} from "./blocks"

export const featureMdxComponents: MDXComponents = {
  // Theme features
  ThemePlayground,
  VariableDiagram,
  ColorGrid,
  DiffgazerPreview,
  // Integration features
  HookSource,
  LibraryHookSource,
  // Rich MDX building blocks
  Example,
  Examples,
  PropsTable: PropsTableBlock,
  ParameterTable: ParameterTableBlock,
  ReturnsTable,
  UsageSnippet,
  InstallCommand,
  SourceViewer: SourceViewerBlock,
  KeyboardNav,
  AccessibilityNotes,
  Notes,
}
