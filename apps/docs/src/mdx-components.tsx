import type { MDXComponents } from "mdx/types"
import {
  featureMdxComponents,
  markdownMdxComponents,
} from "@/components/docs-mdx"

const mdxComponents: MDXComponents = {
  ...markdownMdxComponents,
  ...featureMdxComponents,
}

export function useMDXComponents(): MDXComponents {
  return mdxComponents
}
