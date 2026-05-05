import { defineDocs, defineConfig, frontmatterSchema } from "fumadocs-mdx/config"
import { z } from "zod"
import { docsCodeTheme } from "@diffgazer/registry"

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: frontmatterSchema.extend({
      component: z.string().optional(),
      hook: z.string().optional(),
    }),
  },
})

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      // rehype-code theme type is not compatible with fumadocs mdx config type
      themes: {
        light: docsCodeTheme as any,
        dark: docsCodeTheme as any,
      },
      defaultColor: false,
    },
  },
})
