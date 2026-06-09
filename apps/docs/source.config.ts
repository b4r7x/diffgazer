import { docsCodeTheme } from "@diffgazer/registry";
import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: frontmatterSchema.extend({
      component: z.string().optional(),
      hook: z.string().optional(),
    }),
  },
});

export const legal = defineDocs({
  dir: "content/legal",
  docs: {
    schema: frontmatterSchema.extend({
      lastUpdated: z
        .union([z.string(), z.date()])
        .optional()
        .transform((value) =>
          value instanceof Date ? value.toISOString().slice(0, 10) : value,
        ),
    }),
  },
});

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
            node.properties["data-language"] = this.options.lang;
          },
        },
      ],
    },
  },
});
