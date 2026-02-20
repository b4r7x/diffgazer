import type { MDXComponents } from "mdx/types"
import { ColorGrid } from "@/features/theme/components/color-grid"
import { DiffgazerPreview } from "@/features/theme/components/diffgazer-preview"
import { ThemePlayground } from "@/features/theme/components/theme-playground"
import { VariableDiagram } from "@/features/theme/components/variable-diagram"
import { ComponentDocPage } from "./component-doc-page"
import { KeyscopeHookSource } from "@/components/hook-source"
import { DiffuiHookSource } from "@/components/hook-source"

export const featureMdxComponents: MDXComponents = {
  ThemePlayground,
  VariableDiagram,
  ColorGrid,
  DiffgazerPreview,
  ComponentDocPage,
  KeyscopeHookSource,
  DiffuiHookSource,
}
