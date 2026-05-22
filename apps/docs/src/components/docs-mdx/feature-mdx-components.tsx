import type { MDXComponents } from "mdx/types"
import { ColorGrid } from "@/features/theme/components/color-grid"
import { DiffgazerPreview } from "@/features/theme/components/diffgazer-preview"
import { ThemePlayground } from "@/features/theme/components/theme-playground"
import { VariableDiagram } from "@/features/theme/components/variable-diagram"
import { HookSource, LibraryHookSource } from "@/components/hook-source"
import {
  Example,
  Examples,
  PropsTable,
  ParameterTable,
  ReturnsTable,
  UsageSnippet,
  SourceViewer,
  KeyboardNav,
  AccessibilityNotes,
  Notes,
  ConsumptionBlock,
  APIReference,
} from "./blocks"

export const featureMdxComponents: MDXComponents = {
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
  KeyboardNav,
  AccessibilityNotes,
  Notes,
  ConsumptionBlock,
  APIReference,
}
