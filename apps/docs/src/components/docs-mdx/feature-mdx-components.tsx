import type { MDXComponents } from "mdx/types";
import { HookSource, LibraryHookSource } from "@/components/hook-source";
import { ColorGrid } from "@/features/theme/components/color-grid";
import { DiffgazerPreview } from "@/features/theme/components/diffgazer-preview";
import { ThemePlayground } from "@/features/theme/components/playground";
import { VariableDiagram } from "@/features/theme/components/variable-diagram";
import {
  AccessibilityNotes,
  APIReference,
  ConsumptionBlock,
  Example,
  Examples,
  KeyboardNav,
  Notes,
  ParameterTable,
  PropsTable,
  ReturnsTable,
  SourceViewer,
  Step,
  Steps,
  UsageSnippet,
} from "./blocks";

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
  Steps,
  Step,
  KeyboardNav,
  AccessibilityNotes,
  Notes,
  ConsumptionBlock,
  APIReference,
};
