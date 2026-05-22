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
      themes: {
        light: docsCodeTheme,
        dark: docsCodeTheme,
      },
      defaultColor: false,
      transformers: [
        {
          name: "preserve-language",
          pre(node) {
            node.properties["data-language"] = this.options.lang
          },
        },
      ],
    },
  },
})
