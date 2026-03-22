import type { MDXComponents } from "mdx/types"
import { ColorGrid } from "@/features/theme/components/color-grid"
import { DiffgazerPreview } from "@/features/theme/components/diffgazer-preview"
import { ThemePlayground } from "@/features/theme/components/theme-playground"
import { VariableDiagram } from "@/features/theme/components/variable-diagram"
import { ComponentDocPage } from "./component-doc-page"
import { HookDocPageMdx } from "./hook-doc-page-mdx"
import { HookSource, LibraryHookSource } from "@/components/hook-source"

export const featureMdxComponents: MDXComponents = {
  ThemePlayground,
  VariableDiagram,
  ColorGrid,
  DiffgazerPreview,
  ComponentDocPage,
  HookDocPage: HookDocPageMdx,
  HookSource,
  LibraryHookSource,
}
