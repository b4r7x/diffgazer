import { defineDocs, defineConfig, frontmatterSchema } from "fumadocs-mdx/config"
import { z } from "zod"
import { docsCodeTheme } from "./code-theme"

export const docs = defineDocs({
  dir: "content/generated-docs",
  docs: {
    schema: frontmatterSchema.extend({
      component: z.string().optional(),
    }),
  },
})

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: docsCodeTheme as any,
        dark: docsCodeTheme as any,
      },
      defaultColor: false,
    },
  },
})
